import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestById, updateLessonRequest } from '@/lib/sheets'

// Tutor-only override of an existing recurring booking's schedule — "always
// an override," per the product decision that a tutor modifying a student's
// standing lesson schedule never needs parent approval (unlike the
// propose/approve dance for a single occurrence's time, see
// /api/lessons/[id]/occurrences). Only affects future occurrence
// *expansion* (expandLessonRequestOccurrences reads these fields live) —
// already-materialized Lesson rows for past/upcoming occurrences are a
// separate tab and are untouched by this write.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const existing = await getLessonRequestById(id)
  if (!existing || existing.tutorUserId !== session.userId) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  if (existing.repeatType === 'once') {
    return NextResponse.json({ error: 'This is a one-time booking — edit its date/time instead.' }, { status: 400 })
  }
  if (existing.status !== 'in_progress' || !existing.acceptedAt) {
    return NextResponse.json({ error: "Only a live recurring booking's schedule can be edited." }, { status: 400 })
  }

  const body = await request.json()
  const { repeatType, repeatInterval, repeatDays, endsType, endsDate, endsAfterCount } = body as {
    repeatType?: string
    repeatInterval?: number
    repeatDays?: string[]
    endsType?: string
    endsDate?: string
    endsAfterCount?: number
  }

  if (!repeatType || !['daily', 'weekly', 'monthly', 'yearly'].includes(repeatType)) {
    return NextResponse.json({ error: 'Invalid repeatType.' }, { status: 400 })
  }
  if (repeatType === 'weekly' && (!Array.isArray(repeatDays) || repeatDays.length === 0)) {
    return NextResponse.json({ error: 'Pick at least one day.' }, { status: 400 })
  }
  if (endsType === 'on' && !endsDate) {
    return NextResponse.json({ error: 'Pick an end date.' }, { status: 400 })
  }
  if (endsType === 'after' && (!endsAfterCount || endsAfterCount < 1)) {
    return NextResponse.json({ error: 'Enter at least 1 lesson.' }, { status: 400 })
  }

  const updated = await updateLessonRequest(id, {
    repeatType: repeatType as 'daily' | 'weekly' | 'monthly' | 'yearly',
    repeatInterval: repeatInterval ?? 1,
    repeatDays: repeatType === 'weekly' ? (repeatDays ?? []) : [],
    endsType: (endsType as 'never' | 'on' | 'after') ?? 'never',
    endsDate: endsType === 'on' ? (endsDate ?? '') : '',
    endsAfterCount: endsType === 'after' ? (endsAfterCount ?? 0) : 0,
  })
  if (!updated) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

  return NextResponse.json({ ok: true, request: updated })
}
