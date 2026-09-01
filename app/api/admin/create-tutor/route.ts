import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUserByEmail, createUser, createTutorProfile } from '@/lib/sheets'
import { DEFAULT_TUTOR_PASSWORD, DEFAULT_AVATAR_URL } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, instruments, bio, school, credentials, location } = body

    if (!name || !email || !instruments?.length) {
      return NextResponse.json({ error: 'Name, email, and instruments are required.' }, { status: 400 })
    }

    const existing = await getUserByEmail(email)
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const userId = randomUUID()
    const now = new Date().toISOString()
    const passwordHash = DEFAULT_TUTOR_PASSWORD // plaintext (demo)

    await createUser({ id: userId, email, name, role: 'tutor', passwordHash, createdAt: now })
    await createTutorProfile({
      userId, email, name,
      instruments: Array.isArray(instruments) ? instruments : [instruments],
      bio: bio ?? '',
      school: school ?? '',
      credentials: credentials ?? '',
      location: location ?? '',
      photoUrl: DEFAULT_AVATAR_URL,
      lessonsCompleted: 0,
      hoursCompleted: 0,
      rating: 0,
    })

    return NextResponse.json({ ok: true, userId })
  } catch (err) {
    console.error('[create-tutor]', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
