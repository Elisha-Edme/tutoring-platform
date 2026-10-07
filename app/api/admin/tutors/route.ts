import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getSession } from '@/lib/auth'
import { getAllTutors, getAllOccurrences, getAllReviews, getUserByEmail, createUser, createTutorProfile } from '@/lib/sheets'
import { computeTutorStats } from '@/lib/lessons'
import { DEFAULT_AVATAR_URL } from '@/lib/constants'

// Deliberately a separate route from the public GET /api/tutors (same join)
// rather than reusing it — that route is intentionally unauthenticated, and
// layering an admin-only check onto it would blur which one is public.
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [tutors, occurrences, reviews] = await Promise.all([
    getAllTutors(),
    getAllOccurrences(),
    getAllReviews(),
  ])

  const enriched = tutors.map(t => ({
    ...t,
    ...computeTutorStats(t.userId, occurrences, reviews),
  }))

  return NextResponse.json(enriched)
}

// Fixed legacy password shared by the ~35 originally-seeded tutors (see
// docs/HANDOFF.md) — intentionally not admin-entered or randomly generated.
const LEGACY_DEFAULT_PASSWORD = 'TuneUp123'

// A second, parallel path to invite-by-email (POST /api/admin/tutor-invites):
// the admin fills in the tutor's full profile directly and the account is
// created immediately, no token/email round-trip required.
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, email, instruments, bio = '', credentials = '', school = '', location = '' } = body

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A name and valid email are required.' }, { status: 400 })
    }
    if (!Array.isArray(instruments) || instruments.length === 0) {
      return NextResponse.json({ error: 'Select at least one instrument.' }, { status: 400 })
    }

    const existing = await getUserByEmail(email)
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const userId = randomUUID()
    const now = new Date().toISOString()

    await createUser({ id: userId, email, name, role: 'tutor', passwordHash: LEGACY_DEFAULT_PASSWORD, createdAt: now })
    await createTutorProfile({
      userId, email, name, instruments, bio, school, credentials, location,
      photoUrl: DEFAULT_AVATAR_URL, lessonsCompleted: 0, hoursCompleted: 0, rating: 0,
    })

    return NextResponse.json({ ok: true, tutorUserId: userId })
  } catch (err) {
    console.error('[admin/tutors] POST', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
