import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTutorByUserId, updateTutorProfile, getOccurrencesByTutor, getReviewsByTutor } from '@/lib/sheets'
import { computeTutorStats } from '@/lib/lessons'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [tutor, occurrences, reviews] = await Promise.all([
      getTutorByUserId(session.userId),
      getOccurrencesByTutor(session.userId),
      getReviewsByTutor(session.userId),
    ])
    if (!tutor) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    // Mirror GET /api/tutors: recompute live instead of trusting the
    // cosmetic sheet-mirrored lessonsCompleted/hoursCompleted/rating columns.
    const stats = computeTutorStats(session.userId, occurrences, reviews)
    return NextResponse.json({ tutor: { ...tutor, ...stats } })
  } catch (err) {
    console.error('[tutor/me GET]', err)
    return NextResponse.json({ error: 'Failed to load profile.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    // Tutors may only edit their own bio, instrument proficiencies, and photo here.
    const patch: { bio?: string; instruments?: string[]; photoUrl?: string } = {}
    if (typeof body.bio === 'string') patch.bio = body.bio.trim()
    if (Array.isArray(body.instruments)) {
      patch.instruments = body.instruments.filter((x: unknown) => typeof x === 'string')
    }
    if (typeof body.photoUrl === 'string') patch.photoUrl = body.photoUrl.trim()

    const tutor = await updateTutorProfile(session.userId, patch)
    if (!tutor) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, tutor })
  } catch (err) {
    console.error('[tutor/me PUT]', err)
    return NextResponse.json({ error: 'Failed to save profile.' }, { status: 500 })
  }
}
