import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestById, updateLessonRequest, getExceptionBySourceLessonRequestId, updateAvailabilityException } from '@/lib/sheets'
import { findSchedulingConflict } from '@/lib/availability'
import { formatTime } from '@/lib/schedule'

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

  const newRepeatInterval = repeatInterval ?? 1
  const newRepeatDays = repeatType === 'weekly' ? (repeatDays ?? []) : []
  const newEndsType = (endsType as 'never' | 'on' | 'after') ?? 'never'
  const newEndsDate = endsType === 'on' ? (endsDate ?? '') : ''
  const newEndsAfterCount = endsType === 'after' ? (endsAfterCount ?? 0) : 0

  // Re-check the *new* schedule against the tutor's other bookings, excluding
  // this booking's own current occurrences (we're moving them, not adding a
  // second commitment on top of them).
  const conflict = await findSchedulingConflict(session.userId, {
    ...existing,
    repeatType: repeatType as 'daily' | 'weekly' | 'monthly' | 'yearly',
    repeatInterval: newRepeatInterval,
    repeatDays: newRepeatDays,
    endsType: newEndsType,
    endsDate: newEndsDate,
    endsAfterCount: newEndsAfterCount,
  }, id)
  if (conflict) {
    return NextResponse.json(
      { error: `That conflicts with your own schedule on ${conflict.date} at ${formatTime(conflict.startTime)}.` },
      { status: 409 },
    )
  }

  const updated = await updateLessonRequest(id, {
    repeatType: repeatType as 'daily' | 'weekly' | 'monthly' | 'yearly',
    repeatInterval: newRepeatInterval,
    repeatDays: newRepeatDays,
    endsType: newEndsType,
    endsDate: newEndsDate,
    endsAfterCount: newEndsAfterCount,
  })
  if (!updated) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

  // Keep the mirrored 'booked' exception row (see lib/booking-completion.ts)
  // in sync — it's display-only, but a stale row would show the wrong days/
  // hours on the tutor's own weekly schedule.
  const exc = await getExceptionBySourceLessonRequestId(id)
  if (exc) {
    await updateAvailabilityException(exc.id, {
      repeatType: updated.repeatType,
      repeatInterval: updated.repeatInterval,
      repeatDays: updated.repeatDays,
      endsType: updated.endsType,
      endsDate: updated.endsDate,
      endsAfterCount: updated.endsAfterCount,
    })
  }

  return NextResponse.json({ ok: true, request: updated })
}
