import { google } from 'googleapis'
import type {
  User, TutorProfile, ParentProfile, Child,
  TutorAvailabilityRule, AvailabilityException, LessonRequest, TutorStudent,
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

async function getSheets() {
  const auth = getAuth()
  return google.sheets({ version: 'v4', auth })
}

const SHEET_ID = () => process.env.GOOGLE_SHEET_ID!

// Row 1 of every tab is a human-readable header, so data starts at row 2.
async function getDataRows(tab: string): Promise<string[][]> {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A2:Z`,
  })
  return (res.data.values as string[][] | null | undefined) ?? []
}

async function appendRows(tab: string, rows: string[][]): Promise<void> {
  if (rows.length === 0) return
  const sheets = await getSheets()
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A:Z`,
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
// Columns: id, tutorUserId, startDate, endDate, type, startTime, endTime, createdAt

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
  }
}

function exceptionToRow(e: AvailabilityException): string[] {
  return [e.id, e.tutorUserId, e.startDate, e.endDate, e.type, e.startTime, e.endTime, e.createdAt]
}

export async function createAvailabilityException(exc: AvailabilityException): Promise<void> {
  await appendRow('AvailabilityExceptions', exceptionToRow(exc))
}

export async function getExceptionsByTutor(tutorUserId: string): Promise<AvailabilityException[]> {
  const rows = await getDataRows('AvailabilityExceptions')
  return rows.filter(r => r[1] === tutorUserId).map(rowToException)
}

export async function deleteAvailabilityException(id: string): Promise<void> {
  await deleteRowsWhere('AvailabilityExceptions', 0, id)
}

// ── LessonRequests ─────────────────────────────────────────────────────────────
// Columns: id, parentUserId, childName, tutorUserId,
//          requestedDate, requestedStartTime, requestedEndTime, message, status, createdAt, updatedAt

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
  }
}

function lessonRequestToRow(r: LessonRequest): string[] {
  return [
    r.id, r.parentUserId, r.childName,
    r.tutorUserId,
    r.requestedDate, r.requestedStartTime, r.requestedEndTime,
    r.message, r.status, r.createdAt, r.updatedAt,
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

export async function updateLessonRequestStatus(
  id: string,
  status: LessonRequest['status'],
): Promise<boolean> {
  const rows = await getDataRows('LessonRequests')
  const i = rows.findIndex(r => r[0] === id)
  if (i === -1) return false
  const updated = rowToLessonRequest(rows[i])
  updated.status = status
  updated.updatedAt = new Date().toISOString()
  const sheets = await getSheets()
  const rowNum = i + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `LessonRequests!A${rowNum}:K${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [lessonRequestToRow(updated)] },
  })
  return true
}

// ── TutorStudents ─────────────────────────────────────────────────────────────
// Columns: tutorUserId, parentUserId, childName, addedAt

function rowToTutorStudent(row: string[]): TutorStudent {
  return {
    tutorUserId: row[0],
    parentUserId: row[1],
    childName: row[2] ?? '',
    addedAt: row[3] ?? '',
  }
}

export async function getTutorStudentsByTutor(tutorUserId: string): Promise<TutorStudent[]> {
  const rows = await getDataRows('TutorStudents')
  return rows.filter(r => r[0] === tutorUserId).map(rowToTutorStudent)
}

export async function createTutorStudent(ts: TutorStudent): Promise<void> {
  await appendRow('TutorStudents', [ts.tutorUserId, ts.parentUserId, ts.childName, ts.addedAt])
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
