import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getLessonRequestById,
  getOccurrencesByLessonRequest,
  createLessonOccurrence,
  updateLessonOccurrence,
} from '@/lib/sheets'
import { expandLessonRequestOccurrences, applyOccurrenceOverrides } from '@/lib/schedule'
import { noShowOnceBookingIfApplicable, cancelOnceBookingIfApplicable } from '@/lib/booking-completion'
import { isTerminalOccurrence } from '@/lib/lessons'
import type { LessonOccurrence } from '@/lib/types'
import { randomUUID } from 'crypto'

const VALID_STATUSES = ['no_show', 'cancelled'] as const
type OccurrenceAction = typeof VALID_STATUSES[number]

// Tutor marks a specific occurrence as a no-show (after its scheduled time)
// or cancels it ahead of time (before its scheduled time) — distinct from
// cancelling the whole series via PUT /api/lessons/[id]/status. A parent may
// also cancel (never no-show) their own upcoming occurrence here, with the
// same "any time up until it's happened" allowance — the 48h gate on
// /api/lessons/[id]/occurrences only ever applied to *rescheduling*, never
// to cancelling.
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'tutor' && session.role !== 'parent')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { lessonRequestId, occurrenceDate, status, note = '' } = body as {
    lessonRequestId: string
    occurrenceDate: string
    status: string
    note?: string
  }

  if (!lessonRequestId || !occurrenceDate || !VALID_STATUSES.includes(status as OccurrenceAction)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }
  const targetStatus = status as OccurrenceAction

  const booking = await getLessonRequestById(lessonRequestId)
  const isTutor = session.role === 'tutor' && booking?.tutorUserId === session.userId
  const isParent = session.role === 'parent' && booking?.parentUserId === session.userId
  if (!booking || (!isTutor && !isParent)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  // A no-show is the tutor's call, not the parent's own — a parent can only
  // cancel ahead of time.
  if (targetStatus === 'no_show' && !isTutor) {
    return NextResponse.json({ error: 'Only the tutor can mark a lesson as a no-show.' }, { status: 403 })
  }
  if (booking.status !== 'in_progress' || !booking.acceptedAt) {
    return NextResponse.json({ error: 'This booking is not active.' }, { status: 400 })
  }

  const dayStart = new Date(`${occurrenceDate}T00:00:00`)
  const isRealOccurrence = expandLessonRequestOccurrences(booking, dayStart, dayStart).length > 0
  if (!isRealOccurrence) {
    return NextResponse.json({ error: 'Not a scheduled occurrence of this booking.' }, { status: 400 })
  }

  const existingOccurrences = await getOccurrencesByLessonRequest(lessonRequestId)
  const existing = existingOccurrences.find(o => o.occurrenceDate === occurrenceDate)

  if (existing && isTerminalOccurrence(existing.status)) {
    return NextResponse.json({ error: `This occurrence was already marked ${existing.status}.` }, { status: 400 })
  }

  // Use the effective (post-reschedule) time, not the raw template time, so
  // no-show/cancel eligibility reflects an approved/overridden time change.
  const [effective] = applyOccurrenceOverrides(
    [{ date: occurrenceDate, startTime: booking.requestedStartTime, endTime: booking.requestedEndTime }],
    lessonRequestId,
    existingOccurrences,
  )
  const scheduledEnd = new Date(`${effective.date}T${effective.endTime}:00`)
  const hasPassed = scheduledEnd.getTime() <= Date.now()
  if (targetStatus === 'no_show' && !hasPassed) {
    return NextResponse.json({ error: 'Can only mark a no-show after the scheduled lesson time has passed.' }, { status: 400 })
  }
  if (targetStatus === 'cancelled' && hasPassed) {
    return NextResponse.json({ error: "Can't cancel a lesson that has already happened." }, { status: 400 })
  }

  const completedAt = targetStatus === 'no_show' ? new Date().toISOString() : ''
  let occurrence: LessonOccurrence

  if (existing) {
    const updated = await updateLessonOccurrence(existing.id, { status: targetStatus, completedAt, summary: note })
    if (!updated) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
    occurrence = updated
  } else {
    occurrence = {
      id: `occ_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      lessonRequestId,
      tutorUserId: booking.tutorUserId,
      parentUserId: booking.parentUserId,
      occurrenceDate,
      occurrenceStartTime: booking.requestedStartTime,
      occurrenceEndTime: booking.requestedEndTime,
      status: targetStatus,
      completedAt,
      summary: note,
      reminder10SentAt: '',
      reminder60SentAt: '',
      reminder24hSentAt: '',
      reminder1hSentAt: '',
      createdAt: new Date().toISOString(),
      proposedDate: '',
      proposedStartTime: '',
      proposedEndTime: '',
      proposedBy: '',
      rescheduledDate: '',
    }
    await createLessonOccurrence(occurrence)
  }

  if (targetStatus === 'no_show') {
    await noShowOnceBookingIfApplicable(booking)
  } else {
    await cancelOnceBookingIfApplicable(
      booking,
      session.name,
      session.role as 'tutor' | 'parent',
      new URL(session.role === 'tutor' ? '/tutors' : '/dashboard/tutor', request.url).toString(),
    )
  }

  return NextResponse.json({ ok: true, occurrence })
}
