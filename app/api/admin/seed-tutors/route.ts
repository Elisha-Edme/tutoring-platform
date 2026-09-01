import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUserByEmail, createUser, createTutorProfile } from '@/lib/sheets'
import { SEED_TUTORS } from '@/lib/tutor-seed-data'
import { DEFAULT_TUTOR_PASSWORD, DEFAULT_AVATAR_URL } from '@/lib/constants'

export async function POST() {
  const results: { name: string; status: 'created' | 'skipped' }[] = []

  for (const tutor of SEED_TUTORS) {
    const existing = await getUserByEmail(tutor.email)
    if (existing) {
      results.push({ name: tutor.name, status: 'skipped' })
      continue
    }

    const userId = randomUUID()
    const now = new Date().toISOString()
    const passwordHash = DEFAULT_TUTOR_PASSWORD // plaintext (demo)

    await createUser({ id: userId, email: tutor.email, name: tutor.name, role: 'tutor', passwordHash, createdAt: now })
    await createTutorProfile({
      userId,
      email: tutor.email,
      name: tutor.name,
      instruments: tutor.instruments,
      bio: tutor.bio,
      school: tutor.school,
      credentials: tutor.credentials,
      location: tutor.location,
      photoUrl: DEFAULT_AVATAR_URL,
      lessonsCompleted: 0,
      hoursCompleted: 0,
      rating: 0,
    })

    results.push({ name: tutor.name, status: 'created' })
  }

  return NextResponse.json({ ok: true, results })
}
