import { google } from 'googleapis'
import type {
  User, TutorProfile, ParentProfile, Child,
  TutorAvailabilityRule, AvailabilityException, LessonRequest, TutorStudent, Review,
  LessonOccurrence,
} from './types'

function getPrivateKey(): string {
  // Prefer base64-encoded key (avoids all newline escaping issues on Vercel)
  if (process.env.GOOGLE_PRIVATE_KEY_B64) {
    return Buffer.from(process.env.GOOGLE_PRIVATE_KEY_B64, 'base64').toString('utf-8')
  }
  return (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: getPrivateKey(),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

// Reused across calls within the same warm server instance — building a new
// GoogleAuth/JWT client per call forces a fresh OAuth token fetch every time,
// which adds latency and load for no benefit (the client itself is stateless
// per spreadsheet/request).
let sheetsClient: ReturnType<typeof google.sheets> | null = null
async function getSheets() {
  if (!sheetsClient) sheetsClient = google.sheets({ version: 'v4', auth: getAuth() })
  return sheetsClient
}

const SHEET_ID = () => process.env.GOOGLE_SHEET_ID!

// Coalesces truly concurrent reads of the same tab into one API call — e.g. a
// dashboard whose several panels each independently fetch and happen to both
// need LessonRequests at the same moment. Not a cache: nothing lingers after
// the read resolves, so this can never serve stale data, only avoid a
// redundant simultaneous one. This is the main lever against Google Sheets'
// "Read requests per minute per user" quota (default 60/min) — a page with
// several panels can otherwise easily fire a dozen+ near-simultaneous reads.
const inFlightReads = new Map<string, Promise<string[][]>>()

// Row 1 of every tab is a human-readable header, so data starts at row 2.
async function getDataRows(tab: string): Promise<string[][]> {
  const existing = inFlightReads.get(tab)
  if (existing) return existing

  const promise = (async () => {
    const sheets = await getSheets()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: `${tab}!A2:Z`,
    })
    return (res.data.values as string[][] | null | undefined) ?? []
  })()

  inFlightReads.set(tab, promise)
  try {
    return await promise
  } finally {
    inFlightReads.delete(tab)
  }
}

// 1-indexed column number -> letter (e.g. 1 -> 'A', 17 -> 'Q'). Every tab in
// this app has well under 26 columns, so a single letter always suffices.
function columnLetter(n: number): string {
  return String.fromCharCode(64 + n)
}

// `values.append` finds its target by scanning for a contiguous non-empty
// block of rows and aligning new data to THAT block's existing column shape —
// it doesn't just write at column A of the requested range. Once any one row
// in a tab ends up misaligned (e.g. from a past bug, or a gap breaking the
// "contiguous" scan), every future append inherits the same misalignment,
// silently shifting real data into the wrong columns. `insertDataOption:
// 'INSERT_ROWS'` doesn't fix this — it only changes shift-vs-overwrite below
// the detected block, not the column it anchors to. Reading the current row
// count and writing with `values.update` on a fully-specified range sidesteps
// that detection entirely: it's a plain write to an exact address, so there's
// nothing left to misdetect. A wide read range (well past any historical
// corruption) keeps the row count accurate.
async function getNextRowNumber(tab: string): Promise<number> {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A2:ZZ`,
  })
  const rows = (res.data.values as string[][] | null | undefined) ?? []
  return rows.length + 2
}

async function appendRows(tab: string, rows: string[][]): Promise<void> {
  if (rows.length === 0) return
  const sheets = await getSheets()
  const lastCol = columnLetter(rows[0].length)
  const startRow = await getNextRowNumber(tab)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A${startRow}:${lastCol}${startRow + rows.length - 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  })
}

async function appendRow(tab: string, row: string[]): Promise<void> {
  await appendRows(tab, [row])
}

// ── Users ──────────────────────────────────────────────────────────────────────
// Columns: id, email, name, role, passwordHash, createdAt

function rowToUser(row: string[]): User {
  return {
    id: row[0],
    email: row[1],
    name: row[2],
    role: row[3] as User['role'],
    passwordHash: row[4] ?? '',
    createdAt: row[5] ?? '',
  }
}

function userToRow(u: User): string[] {
  return [u.id, u.email, u.name, u.role, u.passwordHash, u.createdAt]
}

export async function createUser(user: User): Promise<void> {
  await appendRow('Users', userToRow(user))
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await getDataRows('Users')
  const row = rows.find(r => r[1]?.toLowerCase() === email.toLowerCase())
  return row ? rowToUser(row) : null
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await getDataRows('Users')
  const row = rows.find(r => r[0] === id)
  return row ? rowToUser(row) : null
}

// ── TutorProfiles ──────────────────────────────────────────────────────────────
// Columns: userId, email, name, instruments, bio, school, credentials, location, photoUrl, lessonsCompleted, hoursCompleted, rating

function rowToTutor(row: string[]): TutorProfile {
  return {
    userId: row[0],
    email: row[1],
    name: row[2],
    instruments: row[3] ? row[3].split(',').map(s => s.trim()) : [],
    bio: row[4] ?? '',
    school: row[5] ?? '',
    credentials: row[6] ?? '',
    location: row[7] ?? '',
    photoUrl: row[8] ?? '',
    lessonsCompleted: parseInt(row[9] ?? '0', 10),
    hoursCompleted: parseFloat(row[10] ?? '0'),
    rating: parseFloat(row[11] ?? '0'),
  }
}

function tutorToRow(t: TutorProfile): string[] {
  return [
    t.userId, t.email, t.name,
    t.instruments.join(', '),
    t.bio, t.school, t.credentials, t.location, t.photoUrl,
    String(t.lessonsCompleted), String(t.hoursCompleted), String(t.rating),
  ]
}

export async function createTutorProfile(profile: TutorProfile): Promise<void> {
  await appendRow('TutorProfiles', tutorToRow(profile))
}

export async function getAllTutors(): Promise<TutorProfile[]> {
  const rows = await getDataRows('TutorProfiles')
  return rows.filter(r => r.length > 0 && r[0]).map(rowToTutor)
}

export async function getTutorByUserId(userId: string): Promise<TutorProfile | null> {
  const rows = await getDataRows('TutorProfiles')
  const row = rows.find(r => r[0] === userId)
  return row ? rowToTutor(row) : null
}

// Merges `patch` into a tutor's row and writes it back. Returns the updated
// profile, or null if no tutor with that userId exists.
export async function updateTutorProfile(
  userId: string,
  patch: Partial<TutorProfile>,
): Promise<TutorProfile | null> {
  const rows = await getDataRows('TutorProfiles')
  const i = rows.findIndex(r => r[0] === userId)
  if (i === -1) return null
  const updated = { ...rowToTutor(rows[i]), ...patch }
  const sheets = await getSheets()
  const r = i + 2 // row 1 is the header; data row i is sheet row i + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `TutorProfiles!A${r}:Z${r}`,
    valueInputOption: 'RAW',
    requestBody: { values: [tutorToRow(updated)] },
  })
  return updated
}

// ── ParentProfiles ─────────────────────────────────────────────────────────────
// Columns: userId, email, name
// Children live in their own tab (one row per child) instead of a JSON blob.

export async function createParentProfile(profile: ParentProfile): Promise<void> {
  await appendRow('ParentProfiles', [profile.userId, profile.email, profile.name])
  await appendRows(
    'Children',
    profile.children.map(c => [profile.userId, c.name, c.grade, c.instruments.join(', ')]),
  )
}

export async function getParentProfile(userId: string): Promise<ParentProfile | null> {
  const rows = await getDataRows('ParentProfiles')
  const row = rows.find(r => r[0] === userId)
  if (!row) return null
  const children = await getChildrenByParent(userId)
  return { userId: row[0], email: row[1], name: row[2], children }
}

// Bulk read, without children — pair with getAllChildren() and group by
// parentUserId, same as getParentProfile() does per-id.
export async function getAllParentProfiles(): Promise<Omit<ParentProfile, 'children'>[]> {
  const rows = await getDataRows('ParentProfiles')
  return rows.filter(r => r.length > 0 && r[0]).map(r => ({ userId: r[0], email: r[1], name: r[2] }))
}

// ── Children ─────────────────────────────────────────────────────────────────
// Columns: parentUserId, name, grade, instrument

export async function getChildrenByParent(parentUserId: string): Promise<Child[]> {
  const rows = await getDataRows('Children')
  return rows
    .filter(r => r[0] === parentUserId)
    .map(r => ({
      name: r[1] ?? '',
      grade: r[2] ?? '',
      instruments: r[3] ? r[3].split(',').map(s => s.trim()) : [],
    }))
}

export async function getAllChildren(): Promise<(Child & { parentUserId: string })[]> {
  const rows = await getDataRows('Children')
  return rows.filter(r => r.length > 0 && r[0]).map(r => ({
    parentUserId: r[0],
    name: r[1] ?? '',
    grade: r[2] ?? '',
    instruments: r[3] ? r[3].split(',').map(s => s.trim()) : [],
  }))
}

// ── Deletion ─────────────────────────────────────────────────────────────────

async function getSheetIdByTitle(title: string): Promise<number | null> {
  const sheets = await getSheets()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID() })
  const sheet = meta.data.sheets?.find(s => s.properties?.title === title)
  return sheet?.properties?.sheetId ?? null
}

// Deletes every data row in `tab` whose column `colIndex` equals `value`.
// Row 1 is the header; data row i (from getDataRows) is 0-based sheet row i + 1.
async function deleteRowsWhere(tab: string, colIndex: number, value: string): Promise<number> {
  const sheetId = await getSheetIdByTitle(tab)
  if (sheetId == null) return 0
  const rows = await getDataRows(tab)
  const matches = rows
    .map((r, i) => (r[colIndex] === value ? i : -1))
    .filter(i => i >= 0)
    .sort((a, b) => b - a) // delete bottom-up so indices stay valid
  if (matches.length === 0) return 0
  const sheets = await getSheets()
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: {
      requests: matches.map(i => ({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 },
        },
      })),
    },
  })
  return matches.length
}

export async function deleteTutorByEmail(email: string): Promise<{ users: number; tutors: number }> {
  const users = await deleteRowsWhere('Users', 1, email)
  const tutors = await deleteRowsWhere('TutorProfiles', 1, email)
  return { users, tutors }
}

// For non-tutor accounts (e.g. admin) that have no TutorProfiles row to clean up.
export async function deleteUserByEmail(email: string): Promise<number> {
  return deleteRowsWhere('Users', 1, email)
}

// ── TutorAvailability ─────────────────────────────────────────────────────────
// Columns: id, tutorUserId, startTime, endTime,
//          repeatType, repeatInterval, repeatDays, endsType, endsDate, endsAfterCount, createdAt

function rowToAvailRule(row: string[]): TutorAvailabilityRule {
  return {
    id: row[0],
    tutorUserId: row[1],
    startTime: row[2] ?? '',
    endTime: row[3] ?? '',
    repeatType: (row[4] ?? 'weekly') as TutorAvailabilityRule['repeatType'],
    repeatInterval: parseInt(row[5] ?? '1', 10),
    repeatDays: row[6] ? row[6].split(',').map(s => s.trim()) : [],
    endsType: (row[7] ?? 'never') as TutorAvailabilityRule['endsType'],
    endsDate: row[8] ?? '',
    endsAfterCount: parseInt(row[9] ?? '0', 10),
    createdAt: row[10] ?? '',
  }
}

function availRuleToRow(r: TutorAvailabilityRule): string[] {
  return [
    r.id, r.tutorUserId, r.startTime, r.endTime,
    r.repeatType, String(r.repeatInterval), r.repeatDays.join(','),
    r.endsType, r.endsDate ?? '', String(r.endsAfterCount ?? 0), r.createdAt,
  ]
}

export async function createAvailabilityRule(rule: TutorAvailabilityRule): Promise<void> {
  await appendRow('TutorAvailability', availRuleToRow(rule))
}

export async function getAvailabilityRulesByTutor(tutorUserId: string): Promise<TutorAvailabilityRule[]> {
  const rows = await getDataRows('TutorAvailability')
  return rows.filter(r => r[1] === tutorUserId).map(rowToAvailRule)
}

export async function deleteAvailabilityRule(id: string): Promise<void> {
  await deleteRowsWhere('TutorAvailability', 0, id)
}

// ── AvailabilityExceptions ─────────────────────────────────────────────────────
// Columns: id, tutorUserId, startDate, endDate, type, startTime, endTime, createdAt,
//          repeatType, repeatInterval, repeatDays, endsType, endsDate, endsAfterCount, sourceLessonRequestId
// The last 7 columns are only ever populated for type='booked' rows (see
// AvailabilityException in lib/types.ts) — blank/0 for manual 'blocked'|'modified'
// rows, decoded with the same defaults used elsewhere in this file.

function rowToException(row: string[]): AvailabilityException {
  return {
    id: row[0],
    tutorUserId: row[1],
    startDate: row[2] ?? '',
    endDate: row[3] ?? row[2] ?? '',
    type: (row[4] ?? 'blocked') as AvailabilityException['type'],
    startTime: row[5] ?? '',
    endTime: row[6] ?? '',
    createdAt: row[7] ?? '',
    repeatType: (row[8] ?? '') as AvailabilityException['repeatType'],
    repeatInterval: parseInt(row[9] || '1', 10),
    repeatDays: row[10] ? row[10].split(',').map(s => s.trim()) : [],
    endsType: (row[11] ?? '') as AvailabilityException['endsType'],
    endsDate: row[12] ?? '',
    endsAfterCount: parseInt(row[13] || '0', 10),
    sourceLessonRequestId: row[14] ?? '',
  }
}

function exceptionToRow(e: AvailabilityException): string[] {
  return [
    e.id, e.tutorUserId, e.startDate, e.endDate, e.type, e.startTime, e.endTime, e.createdAt,
    e.repeatType, String(e.repeatInterval), e.repeatDays.join(','),
    e.endsType, e.endsDate ?? '', String(e.endsAfterCount ?? 0), e.sourceLessonRequestId,
  ]
}

export async function createAvailabilityException(exc: AvailabilityException): Promise<void> {
  await appendRow('AvailabilityExceptions', exceptionToRow(exc))
}

export async function getExceptionsByTutor(tutorUserId: string): Promise<AvailabilityException[]> {
  const rows = await getDataRows('AvailabilityExceptions')
  return rows.filter(r => r[1] === tutorUserId).map(rowToException)
}

export async function getExceptionBySourceLessonRequestId(lessonRequestId: string): Promise<AvailabilityException | null> {
  const rows = await getDataRows('AvailabilityExceptions')
  const row = rows.find(r => r[14] === lessonRequestId)
  return row ? rowToException(row) : null
}

export async function updateAvailabilityException(
  id: string,
  patch: Partial<AvailabilityException>,
): Promise<AvailabilityException | null> {
  const rows = await getDataRows('AvailabilityExceptions')
  const i = rows.findIndex(r => r[0] === id)
  if (i === -1) return null
  const updated = { ...rowToException(rows[i]), ...patch }
  const sheets = await getSheets()
  const r = i + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `AvailabilityExceptions!A${r}:O${r}`,
    valueInputOption: 'RAW',
    requestBody: { values: [exceptionToRow(updated)] },
  })
  return updated
}

export async function deleteAvailabilityException(id: string): Promise<void> {
  await deleteRowsWhere('AvailabilityExceptions', 0, id)
}

// ── LessonRequests ─────────────────────────────────────────────────────────────
// Columns: id, parentUserId, childName, tutorUserId,
//          requestedDate, requestedStartTime, requestedEndTime, message, status, createdAt, updatedAt,
//          repeatType, repeatInterval, repeatDays, endsType, endsDate, endsAfterCount, initiatedBy,
//          acceptedAt, declineReason

function rowToLessonRequest(row: string[]): LessonRequest {
  return {
    id: row[0],
    parentUserId: row[1],
    childName: row[2] ?? '',
    tutorUserId: row[3],
    requestedDate: row[4] ?? '',
    requestedStartTime: row[5] ?? '',
    requestedEndTime: row[6] ?? '',
    message: row[7] ?? '',
    status: (row[8] ?? 'pending') as LessonRequest['status'],
    createdAt: row[9] ?? '',
    updatedAt: row[10] ?? '',
    repeatType: (row[11] || 'once') as LessonRequest['repeatType'],
    repeatInterval: parseInt(row[12] || '1', 10),
    repeatDays: row[13] ? row[13].split(',').map(s => s.trim()) : [],
    endsType: (row[14] || 'never') as LessonRequest['endsType'],
    endsDate: row[15] ?? '',
    endsAfterCount: parseInt(row[16] || '0', 10),
    // Every legacy pending row came from the parent-only request route (the
    // pre-redesign tutor-schedule route always wrote 'in_progress' directly,
    // never 'pending'), so defaulting a blank cell to 'parent' never
    // mislabels a row in a way that matters — see isAwaitingParentApproval.
    initiatedBy: (row[17] || 'parent') as LessonRequest['initiatedBy'],
    acceptedAt: row[18] ?? '',
    declineReason: row[19] ?? '',
  }
}

function lessonRequestToRow(r: LessonRequest): string[] {
  return [
    r.id, r.parentUserId, r.childName,
    r.tutorUserId,
    r.requestedDate, r.requestedStartTime, r.requestedEndTime,
    r.message, r.status, r.createdAt, r.updatedAt,
    r.repeatType, String(r.repeatInterval), r.repeatDays.join(','),
    r.endsType, r.endsDate ?? '', String(r.endsAfterCount ?? 0),
    r.initiatedBy, r.acceptedAt, r.declineReason,
  ]
}

export async function createLessonRequest(req: LessonRequest): Promise<void> {
  await appendRow('LessonRequests', lessonRequestToRow(req))
}

export async function getLessonRequestsByTutor(tutorUserId: string): Promise<LessonRequest[]> {
  const rows = await getDataRows('LessonRequests')
  return rows.filter(r => r[3] === tutorUserId).map(rowToLessonRequest)
}

export async function getLessonRequestsByParent(parentUserId: string): Promise<LessonRequest[]> {
  const rows = await getDataRows('LessonRequests')
  return rows.filter(r => r[1] === parentUserId).map(rowToLessonRequest)
}

export async function getAllLessonRequests(): Promise<LessonRequest[]> {
  const rows = await getDataRows('LessonRequests')
  return rows.map(rowToLessonRequest)
}

export async function getLessonRequestById(id: string): Promise<LessonRequest | null> {
  const rows = await getDataRows('LessonRequests')
  const row = rows.find(r => r[0] === id)
  return row ? rowToLessonRequest(row) : null
}

export async function updateLessonRequest(
  id: string,
  patch: Partial<LessonRequest>,
): Promise<LessonRequest | null> {
  const rows = await getDataRows('LessonRequests')
  const i = rows.findIndex(r => r[0] === id)
  if (i === -1) return null
  const updated: LessonRequest = {
    ...rowToLessonRequest(rows[i]),
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  const sheets = await getSheets()
  const rowNum = i + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `LessonRequests!A${rowNum}:T${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [lessonRequestToRow(updated)] },
  })
  return updated
}

// ── TutorStudents ─────────────────────────────────────────────────────────────
// Columns: tutorUserId, parentUserId, childName, addedAt, id, status,
//          proposedLessonDate, proposedLessonStartTime, proposedLessonEndTime,
//          proposedRepeatType, proposedRepeatInterval, proposedRepeatDays,
//          proposedEndsType, proposedEndsDate, proposedEndsAfterCount

function rowToTutorStudent(row: string[]): TutorStudent {
  return {
    tutorUserId: row[0],
    parentUserId: row[1],
    childName: row[2] ?? '',
    addedAt: row[3] ?? '',
    id: row[4] ?? '',
    // Rows created before this approval flow existed have no status cell —
    // grandfather them in as already-approved rather than requiring a
    // backfill write to the live sheet.
    status: (row[5] || 'approved') as TutorStudent['status'],
    proposedLessonDate: row[6] ?? '',
    proposedLessonStartTime: row[7] ?? '',
    proposedLessonEndTime: row[8] ?? '',
    proposedRepeatType: (row[9] || 'once') as TutorStudent['proposedRepeatType'],
    proposedRepeatInterval: parseInt(row[10] || '1', 10),
    proposedRepeatDays: row[11] ? row[11].split(',').map(s => s.trim()) : [],
    proposedEndsType: (row[12] || 'never') as TutorStudent['proposedEndsType'],
    proposedEndsDate: row[13] ?? '',
    proposedEndsAfterCount: parseInt(row[14] || '0', 10),
  }
}

function tutorStudentToRow(ts: TutorStudent): string[] {
  return [
    ts.tutorUserId, ts.parentUserId, ts.childName, ts.addedAt,
    ts.id, ts.status, ts.proposedLessonDate, ts.proposedLessonStartTime, ts.proposedLessonEndTime,
    ts.proposedRepeatType, String(ts.proposedRepeatInterval), ts.proposedRepeatDays.join(','),
    ts.proposedEndsType, ts.proposedEndsDate ?? '', String(ts.proposedEndsAfterCount ?? 0),
  ]
}

export async function getTutorStudentsByTutor(tutorUserId: string): Promise<TutorStudent[]> {
  const rows = await getDataRows('TutorStudents')
  return rows.filter(r => r[0] === tutorUserId).map(rowToTutorStudent)
}

export async function getTutorStudentsByParent(parentUserId: string): Promise<TutorStudent[]> {
  const rows = await getDataRows('TutorStudents')
  return rows.filter(r => r[1] === parentUserId).map(rowToTutorStudent)
}

export async function getTutorStudentById(id: string): Promise<TutorStudent | null> {
  const rows = await getDataRows('TutorStudents')
  const row = rows.find(r => r[4] === id)
  return row ? rowToTutorStudent(row) : null
}

export async function createTutorStudent(ts: TutorStudent): Promise<void> {
  await appendRow('TutorStudents', tutorStudentToRow(ts))
}

export async function updateTutorStudent(
  id: string,
  patch: Partial<TutorStudent>,
): Promise<TutorStudent | null> {
  const rows = await getDataRows('TutorStudents')
  const i = rows.findIndex(r => r[4] === id)
  if (i === -1) return null
  const updated: TutorStudent = { ...rowToTutorStudent(rows[i]), ...patch }
  const sheets = await getSheets()
  const rowNum = i + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `TutorStudents!A${rowNum}:O${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [tutorStudentToRow(updated)] },
  })
  return updated
}

export async function deleteTutorStudent(
  tutorUserId: string,
  parentUserId: string,
  childName: string,
): Promise<void> {
  const sheetId = await getSheetIdByTitle('TutorStudents')
  if (sheetId == null) return
  const rows = await getDataRows('TutorStudents')
  const matches = rows
    .map((r, i) => (r[0] === tutorUserId && r[1] === parentUserId && r[2] === childName ? i : -1))
    .filter(i => i >= 0)
    .sort((a, b) => b - a)
  if (matches.length === 0) return
  const sheets = await getSheets()
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: {
      requests: matches.map(i => ({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 },
        },
      })),
    },
  })
}

// ── Lessons (per-occurrence tracking, TS type is still called LessonOccurrence) ─
// Columns: id, lessonRequestId, tutorUserId, parentUserId, occurrenceDate,
//          occurrenceStartTime, occurrenceEndTime, status, completedAt, summary,
//          reminder10SentAt, reminder60SentAt, createdAt, reminder24hSentAt, reminder1hSentAt,
//          proposedDate, proposedStartTime, proposedEndTime, proposedBy, rescheduledDate
// A row exists once there's something to track about an occurrence: its first
// pre-lesson reminder ('upcoming'), a pending/applied reschedule, or a
// terminal outcome ('completed'/'cancelled'/'no_show'). See lib/lessons.ts's
// isTerminalOccurrence().

function rowToLessonOccurrence(row: string[]): LessonOccurrence {
  return {
    id: row[0],
    lessonRequestId: row[1],
    tutorUserId: row[2],
    parentUserId: row[3],
    occurrenceDate: row[4] ?? '',
    occurrenceStartTime: row[5] ?? '',
    occurrenceEndTime: row[6] ?? '',
    status: (row[7] ?? 'completed') as LessonOccurrence['status'],
    completedAt: row[8] ?? '',
    summary: row[9] ?? '',
    reminder10SentAt: row[10] ?? '',
    reminder60SentAt: row[11] ?? '',
    createdAt: row[12] ?? '',
    reminder24hSentAt: row[13] ?? '',
    reminder1hSentAt: row[14] ?? '',
    proposedDate: row[15] ?? '',
    proposedStartTime: row[16] ?? '',
    proposedEndTime: row[17] ?? '',
    proposedBy: (row[18] || '') as LessonOccurrence['proposedBy'],
    rescheduledDate: row[19] ?? '',
  }
}

function lessonOccurrenceToRow(o: LessonOccurrence): string[] {
  return [
    o.id, o.lessonRequestId, o.tutorUserId, o.parentUserId,
    o.occurrenceDate, o.occurrenceStartTime, o.occurrenceEndTime,
    o.status, o.completedAt, o.summary, o.reminder10SentAt, o.reminder60SentAt, o.createdAt,
    o.reminder24hSentAt, o.reminder1hSentAt,
    o.proposedDate, o.proposedStartTime, o.proposedEndTime, o.proposedBy, o.rescheduledDate,
  ]
}

export async function createLessonOccurrence(occ: LessonOccurrence): Promise<void> {
  await appendRow('Lessons', lessonOccurrenceToRow(occ))
}

export async function getAllOccurrences(): Promise<LessonOccurrence[]> {
  const rows = await getDataRows('Lessons')
  return rows.map(rowToLessonOccurrence)
}

export async function getOccurrencesByLessonRequest(lessonRequestId: string): Promise<LessonOccurrence[]> {
  const rows = await getDataRows('Lessons')
  return rows.filter(r => r[1] === lessonRequestId).map(rowToLessonOccurrence)
}

export async function getOccurrencesByTutor(tutorUserId: string): Promise<LessonOccurrence[]> {
  const rows = await getDataRows('Lessons')
  return rows.filter(r => r[2] === tutorUserId).map(rowToLessonOccurrence)
}

export async function getOccurrencesByParent(parentUserId: string): Promise<LessonOccurrence[]> {
  const rows = await getDataRows('Lessons')
  return rows.filter(r => r[3] === parentUserId).map(rowToLessonOccurrence)
}

export async function updateLessonOccurrence(
  id: string,
  patch: Partial<LessonOccurrence>,
): Promise<LessonOccurrence | null> {
  const rows = await getDataRows('Lessons')
  const i = rows.findIndex(r => r[0] === id)
  if (i === -1) return null
  const updated = { ...rowToLessonOccurrence(rows[i]), ...patch }
  const sheets = await getSheets()
  const r = i + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Lessons!A${r}:T${r}`,
    valueInputOption: 'RAW',
    requestBody: { values: [lessonOccurrenceToRow(updated)] },
  })
  return updated
}

// ── Reviews ───────────────────────────────────────────────────────────────────
// Columns: id, tutorUserId, parentUserId, rating, comment, createdAt
// One review per (tutorUserId, parentUserId) pair — a review is of the tutor's
// teaching overall, not of any single lesson occurrence.

function rowToReview(row: string[]): Review {
  return {
    id: row[0],
    tutorUserId: row[1],
    parentUserId: row[2],
    rating: parseInt(row[3] ?? '0', 10),
    comment: row[4] ?? '',
    createdAt: row[5] ?? '',
  }
}

function reviewToRow(r: Review): string[] {
  return [r.id, r.tutorUserId, r.parentUserId, String(r.rating), r.comment, r.createdAt]
}

export async function createReview(review: Review): Promise<void> {
  await appendRow('Reviews', reviewToRow(review))
}

export async function getAllReviews(): Promise<Review[]> {
  const rows = await getDataRows('Reviews')
  return rows.map(rowToReview)
}

export async function getReviewsByTutor(tutorUserId: string): Promise<Review[]> {
  const rows = await getDataRows('Reviews')
  return rows.filter(r => r[1] === tutorUserId).map(rowToReview)
}

export async function getReviewsByParent(parentUserId: string): Promise<Review[]> {
  const rows = await getDataRows('Reviews')
  return rows.filter(r => r[2] === parentUserId).map(rowToReview)
}

export async function getReviewByTutorAndParent(tutorUserId: string, parentUserId: string): Promise<Review | null> {
  const rows = await getDataRows('Reviews')
  const row = rows.find(r => r[1] === tutorUserId && r[2] === parentUserId)
  return row ? rowToReview(row) : null
}

// One-time migration: overwrite the passwordHash column (E) for every tutor row
// with the given plaintext, preserving any non-tutor row's existing value.
export async function resetTutorPasswords(plaintext: string): Promise<number> {
  const rows = await getDataRows('Users') // id, email, name, role, passwordHash, createdAt
  if (rows.length === 0) return 0
  const column = rows.map(r => [r[3] === 'tutor' ? plaintext : (r[4] ?? '')])
  const sheets = await getSheets()
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Users!E2:E${column.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: column },
  })
  return rows.filter(r => r[3] === 'tutor').length
}

// Replaces all of a parent's children rows with the given set (add/edit/remove
// in one shot — children have no per-row id, so we rewrite the whole group).
export async function replaceChildren(parentUserId: string, children: Child[]): Promise<void> {
  await deleteRowsWhere('Children', 0, parentUserId)
  await appendRows(
    'Children',
    children.map(c => [parentUserId, c.name, c.grade, c.instruments.join(', ')]),
  )
}
