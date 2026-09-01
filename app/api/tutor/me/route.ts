import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTutorByUserId, updateTutorProfile } from '@/lib/sheets'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tutor = await getTutorByUserId(session.userId)
    if (!tutor) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    return NextResponse.json({ tutor })
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
    // Tutors may only edit their own bio + instrument proficiencies here.
    const patch: { bio?: string; instruments?: string[] } = {}
    if (typeof body.bio === 'string') patch.bio = body.bio.trim()
    if (Array.isArray(body.instruments)) {
      patch.instruments = body.instruments.filter((x: unknown) => typeof x === 'string')
    }

    const tutor = await updateTutorProfile(session.userId, patch)
    if (!tutor) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, tutor })
  } catch (err) {
    console.error('[tutor/me PUT]', err)
    return NextResponse.json({ error: 'Failed to save profile.' }, { status: 500 })
  }
}
