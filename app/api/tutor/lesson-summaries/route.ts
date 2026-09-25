import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getLessonRequestById,
  getOccurrencesByLessonRequest,
  createLessonOccurrence,
  updateLessonOccurrence,
  getParentProfile,
} from '@/lib/sheets'
import { expandLessonRequestOccurrences } from '@/lib/schedule'
import { completeOnceBookingIfApplicable, incrementTutorStats } from '@/lib/booking-completion'
import { isTerminalOccurrence, lessonDurationHours } from '@/lib/lessons'
import { sendEmail, lessonSummaryReadyEmailHtml } from '@/lib/email'
import type { LessonOccurrence } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { lessonRequestId, occurrenceDate, summary } = body as {
    lessonRequestId: string
    occurrenceDate: string
    summary: string
  }

  if (!lessonRequestId || !occurrenceDate || typeof summary !== 'string' || !summary.trim()) {
    return NextResponse.json({ error: 'lessonRequestId, occurrenceDate, and a non-empty summary are required.' }, { status: 400 })
  }

  const booking = await getLessonRequestById(lessonRequestId)
  if (!booking || booking.tutorUserId !== session.userId) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const existingOccurrences = await getOccurrencesByLessonRequest(lessonRequestId)
  const existing = existingOccurrences.find(o => o.occurrenceDate === occurrenceDate)

  let occurrence: LessonOccurrence
  let wasAlreadySummarized: boolean

  if (existing && existing.status === 'completed') {
    // Already completed (auto by cron, or completed-early previously) — this is just adding/editing the summary.
    wasAlreadySummarized = !!existing.summary
    const updated = await updateLessonOccurrence(existing.id, { summary })
    if (!updated) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
    occurrence = updated
  } else if (existing && isTerminalOccurrence(existing.status)) {
    // Already cancelled or marked no-show — can't retroactively summarize it.
    return NextResponse.json({ error: `This occurrence was already marked ${existing.status}.` }, { status: 400 })
  } else {
    // Either no row yet, or a row exists only as 'upcoming' (a pre-lesson
    // reminder fired but nothing has resolved it) — either way, the tutor is
    // manually completing this occurrence now.
    if (booking.status !== 'in_progress' || !booking.acceptedAt) {
      return NextResponse.json({ error: 'This booking is not active.' }, { status: 400 })
    }
    // Sanity-check occurrenceDate is actually a real occurrence of this booking.
    const dayStart = new Date(`${occurrenceDate}T00:00:00`)
    const isRealOccurrence = expandLessonRequestOccurrences(booking, dayStart, dayStart).length > 0
    if (!isRealOccurrence) {
      return NextResponse.json({ error: 'Not a scheduled occurrence of this booking.' }, { status: 400 })
    }

    wasAlreadySummarized = false
    const completedAt = new Date().toISOString()

    if (existing) {
      const updated = await updateLessonOccurrence(existing.id, { status: 'completed', completedAt, summary })
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
        status: 'completed',
        completedAt,
        summary,
        reminder10SentAt: '',
        reminder60SentAt: '',
        reminder24hSentAt: '',
        reminder1hSentAt: '',
        createdAt: completedAt,
        proposedDate: '',
        proposedStartTime: '',
        proposedEndTime: '',
        proposedBy: '',
        rescheduledDate: '',
      }
      await createLessonOccurrence(occurrence)
    }

    await incrementTutorStats(booking.tutorUserId, lessonDurationHours(occurrence.occurrenceStartTime, occurrence.occurrenceEndTime))

    await completeOnceBookingIfApplicable(
      booking,
      session.name,
      occurrenceDate,
      new URL('/dashboard/parent', request.url).toString(),
    )
  }

  if (!wasAlreadySummarized) {
    try {
      const parent = await getParentProfile(booking.parentUserId)
      if (parent) {
        await sendEmail({
          to: parent.email,
          subject: `Lesson summary from ${session.name}`,
          html: lessonSummaryReadyEmailHtml({
            parentName: parent.name,
            tutorName: session.name,
            childName: booking.childName,
            occurrenceDate,
            summary,
            dashboardUrl: new URL('/dashboard/parent', request.url).toString(),
          }),
        })
      }
    } catch (err) {
      console.error('[tutor/lesson-summaries] failed to send email', err)
    }
  }

  return NextResponse.json({ ok: true, occurrence })
}
