import { google } from 'googleapis'
import type { User, TutorProfile, ParentProfile, Child } from './types'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function getSheets() {
  const auth = getAuth()
  return google.sheets({ version: 'v4', auth })
}

const SHEET_ID = () => process.env.GOOGLE_SHEET_ID!

async function getRows(tab: string): Promise<string[][]> {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A:Z`,
  })
  return (res.data.values as string[][] | null | undefined) ?? []
}

async function appendRow(tab: string, row: string[]): Promise<void> {
  const sheets = await getSheets()
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A:Z`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  })
}

async function updateRow(tab: string, rowIndex: number, row: string[]): Promise<void> {
  const sheets = await getSheets()
  const r = rowIndex + 1
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A${r}:Z${r}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  })
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
  const rows = await getRows('Users')
  const row = rows.find(r => r[1]?.toLowerCase() === email.toLowerCase())
  return row ? rowToUser(row) : null
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await getRows('Users')
  const row = rows.find(r => r[0] === id)
  return row ? rowToUser(row) : null
}

// ── TutorProfiles ──────────────────────────────────────────────────────────────
// Columns: userId, email, name, instruments, bio, school, credentials, location, photoUrl, sessionCount, rating

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
    sessionCount: parseInt(row[9] ?? '0', 10),
    rating: parseFloat(row[10] ?? '0'),
  }
}

function tutorToRow(t: TutorProfile): string[] {
  return [
    t.userId, t.email, t.name,
    t.instruments.join(', '),
    t.bio, t.school, t.credentials, t.location, t.photoUrl,
    String(t.sessionCount), String(t.rating),
  ]
}

export async function createTutorProfile(profile: TutorProfile): Promise<void> {
  await appendRow('TutorProfiles', tutorToRow(profile))
}

export async function getAllTutors(): Promise<TutorProfile[]> {
  const rows = await getRows('TutorProfiles')
  return rows.filter(r => r.length > 0 && r[0]).map(rowToTutor)
}

export async function getTutorByUserId(userId: string): Promise<TutorProfile | null> {
  const rows = await getRows('TutorProfiles')
  const row = rows.find(r => r[0] === userId)
  return row ? rowToTutor(row) : null
}

// ── ParentProfiles ─────────────────────────────────────────────────────────────
// Columns: userId, email, name, children (JSON)

export async function createParentProfile(profile: ParentProfile): Promise<void> {
  await appendRow('ParentProfiles', [
    profile.userId,
    profile.email,
    profile.name,
    JSON.stringify(profile.children),
  ])
}

export async function getParentProfile(userId: string): Promise<ParentProfile | null> {
  const rows = await getRows('ParentProfiles')
  const row = rows.find(r => r[0] === userId)
  if (!row) return null
  let children: Child[] = []
  try { children = JSON.parse(row[3] ?? '[]') } catch {}
  return { userId: row[0], email: row[1], name: row[2], children }
}
