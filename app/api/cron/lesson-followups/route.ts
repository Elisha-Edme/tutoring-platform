import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual, randomUUID } from 'crypto'
import {
  getAllLessonRequests,
  getAllOccurrences,
  createLessonOccurrence,
  updateLessonOccurrence,
  getTutorByUserId,
  getParentProfile,
} from '@/lib/sheets'
import { expandLessonRequestOccurrences, applyOccurrenceOverrides } from '@/lib/schedule'
import { completeOnceBookingIfApplicable, incrementTutorStats } from '@/lib/booking-completion'
import { isTerminalOccurrence, lessonDurationHours } from '@/lib/lessons'
import { sendEmail, tutorSummaryReminderEmailHtml, preLessonReminderEmailHtml } from '@/lib/email'
import type { LessonOccurrence } from '@/lib/types'

const LOOKBACK_DAYS = 7
const REMINDER_THRESHOLDS_MIN = [10, 60] as const
const PRE_LESSON_WINDOW_HOURS = 25

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization')
  const provided = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.nextUrl.searchParams.get('secret')
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function sendSummaryReminder(
  request: NextRequest,
  occ: LessonOccurrence,
  childName: string,
  thresholdMinutes: 10 | 60,
): Promise<boolean> {
  try {
    const tutor = await getTutorByUserId(occ.tutorUserId)
    if (!tutor) return false
    await sendEmail({
      to: tutor.email,
      subject: `Don't forget your lesson summary`,
      html: tutorSummaryReminderEmailHtml({
        tutorName: tutor.name,
        childName,
        occurrenceDate: occ.occurrenceDate,
        occurrenceStartTime: occ.occurrenceStartTime,
        occurrenceEndTime: occ.occurrenceEndTime,
        thresholdMinutes,
        dashboardUrl: new URL('/dashboard/tutor', request.url).toString(),
      }),
    })
    const field = thresholdMinutes === 10 ? 'reminder10SentAt' : 'reminder60SentAt'
    await updateLessonOccurrence(occ.id, { [field]: new Date().toISOString() })
    return true
  } catch (err) {
    // Deliberately does NOT mark as sent — the email is the action here, so a
    // failed send should retry next tick rather than silently vanish.
    console.error('[cron/lesson-followups] failed to send summary reminder', err)
    return false
  }
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const lookbackFrom = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const preLessonTo = new Date(now.getTime() + PRE_LESSON_WINDOW_HOURS * 60 * 60 * 1000)

  const [allBookings, allOccurrences] = await Promise.all([
    getAllLessonRequests(),
    getAllOccurrences(),
  ])

  const activeBookings = allBookings.filter(b => b.status === 'in_progress')

  // One map, mutated in place by every phase below, so later phases in the
  // same tick see rows earlier phases just created/updated.
  const occByKey = new Map<string, LessonOccurrence>(
    allOccurrences.map(o => [`${o.lessonRequestId}|${o.occurrenceDate}`, o]),
  )

  // ── Phase A: auto-complete occurrences whose scheduled end has passed ──────
  let completedCount = 0

  for (const booking of activeBookings) {
    const template = expandLessonRequestOccurrences(booking, lookbackFrom, now)
    const effective = applyOccurrenceOverrides(template, booking.id, allOccurrences)
    for (const occ of effective) {
      const key = `${booking.id}|${occ.templateDate}`
      const scheduledEnd = new Date(`${occ.date}T${occ.endTime}:00`)
      if (scheduledEnd > now) continue // hasn't happened yet — Phase C's concern, not this one

      const existingRow = occByKey.get(key)
      if (existingRow && isTerminalOccurrence(existingRow.status)) continue // already resolved

      let occurrence: LessonOccurrence
      if (existingRow) {
        // Was 'upcoming' (a pre-lesson reminder had fired, or a reschedule
        // was applied) — transition it now.
        const updated = await updateLessonOccurrence(existingRow.id, {
          status: 'completed',
          completedAt: scheduledEnd.toISOString(),
        })
        if (!updated) continue
        occurrence = updated
      } else {
        occurrence = {
          id: `occ_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          lessonRequestId: booking.id,
          tutorUserId: booking.tutorUserId,
          parentUserId: booking.parentUserId,
          occurrenceDate: occ.templateDate,
          occurrenceStartTime: occ.startTime,
          occurrenceEndTime: occ.endTime,
          status: 'completed',
          completedAt: scheduledEnd.toISOString(),
          summary: '',
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

      occByKey.set(key, occurrence)
      completedCount++

      await incrementTutorStats(booking.tutorUserId, lessonDurationHours(occurrence.occurrenceStartTime, occurrence.occurrenceEndTime))

      if (booking.repeatType === 'once') {
        const tutor = await getTutorByUserId(booking.tutorUserId)
        await completeOnceBookingIfApplicable(
          booking,
          tutor?.name ?? 'your tutor',
          occ.templateDate,
          new URL('/dashboard/parent', request.url).toString(),
        )
      }
    }
  }

  // ── Phase B: post-completion "write your summary" reminders (tutor-only) ───
  const awaitingSummary = Array.from(occByKey.values()).filter(o => o.status === 'completed' && !o.summary)

  let reminder10Count = 0
  let reminder60Count = 0

  for (const occ of awaitingSummary) {
    if (!occ.completedAt) continue
    const elapsedMinutes = (now.getTime() - new Date(occ.completedAt).getTime()) / 60000
    const childName = allBookings.find(b => b.id === occ.lessonRequestId)?.childName ?? ''

    for (const threshold of REMINDER_THRESHOLDS_MIN) {
      const alreadySent = threshold === 10 ? occ.reminder10SentAt : occ.reminder60SentAt
      if (alreadySent || elapsedMinutes < threshold) continue
      const sent = await sendSummaryReminder(request, occ, childName, threshold)
      if (sent) {
        if (threshold === 10) reminder10Count++
        else reminder60Count++
      }
    }
  }

  // ── Phase C: pre-lesson reminders, 24h and 1h before, to both parent + tutor ──
  let reminder24hCount = 0
  let reminder1hCount = 0

  for (const booking of activeBookings) {
    const template = expandLessonRequestOccurrences(booking, now, preLessonTo)
    const effective = applyOccurrenceOverrides(template, booking.id, allOccurrences)
    for (const occ of effective) {
      const key = `${booking.id}|${occ.templateDate}`
      const scheduledStart = new Date(`${occ.date}T${occ.startTime}:00`)
      const minutesUntilStart = (scheduledStart.getTime() - now.getTime()) / 60000
      if (minutesUntilStart <= 0) continue // already started/passed — Phase A's concern now

      const existingRow = occByKey.get(key)
      if (existingRow && isTerminalOccurrence(existingRow.status)) continue // e.g. cancelled ahead of time

      // Mutually exclusive by construction (send24h requires >60 min out,
      // send1h requires <=60), so at most one fires per occurrence per tick —
      // this also avoids ever sending an inaccurate "24 hours away" notice
      // once we're already inside the 1-hour window.
      const send24h = minutesUntilStart <= 24 * 60 && minutesUntilStart > 60 && !existingRow?.reminder24hSentAt
      const send1h = minutesUntilStart <= 60 && !existingRow?.reminder1hSentAt
      if (!send24h && !send1h) continue
      const thresholdHours: 24 | 1 = send1h ? 1 : 24

      const [tutor, parent] = await Promise.all([
        getTutorByUserId(booking.tutorUserId),
        getParentProfile(booking.parentUserId),
      ])
      if (!tutor || !parent) continue

      try {
        await sendEmail({
          to: parent.email,
          subject: thresholdHours === 24 ? 'Upcoming lesson tomorrow' : 'Upcoming lesson in about an hour',
          html: preLessonReminderEmailHtml({
            audience: 'parent',
            recipientName: parent.name,
            tutorName: tutor.name,
            childName: booking.childName,
            occurrenceDate: occ.date,
            occurrenceStartTime: occ.startTime,
            occurrenceEndTime: occ.endTime,
            thresholdHours,
            dashboardUrl: new URL('/dashboard/parent', request.url).toString(),
          }),
        })
        await sendEmail({
          to: tutor.email,
          subject: thresholdHours === 24 ? 'Upcoming lesson tomorrow' : 'Upcoming lesson in about an hour',
          html: preLessonReminderEmailHtml({
            audience: 'tutor',
            recipientName: tutor.name,
            tutorName: tutor.name,
            childName: booking.childName,
            occurrenceDate: occ.date,
            occurrenceStartTime: occ.startTime,
            occurrenceEndTime: occ.endTime,
            thresholdHours,
            dashboardUrl: new URL('/dashboard/tutor', request.url).toString(),
          }),
        })
      } catch (err) {
        // Same non-marking convention as Phase B — retry both recipients next tick.
        console.error('[cron/lesson-followups] failed to send pre-lesson reminder', err)
        continue
      }

      const patch: Partial<LessonOccurrence> = send1h
        ? { reminder1hSentAt: new Date().toISOString() }
        : { reminder24hSentAt: new Date().toISOString() }

      if (existingRow) {
        const updated = await updateLessonOccurrence(existingRow.id, patch)
        if (updated) occByKey.set(key, updated)
      } else {
        const newRow: LessonOccurrence = {
          id: `occ_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          lessonRequestId: booking.id,
          tutorUserId: booking.tutorUserId,
          parentUserId: booking.parentUserId,
          occurrenceDate: occ.templateDate,
          occurrenceStartTime: occ.startTime,
          occurrenceEndTime: occ.endTime,
          status: 'upcoming',
          completedAt: '',
          summary: '',
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
          ...patch,
        }
        await createLessonOccurrence(newRow)
        occByKey.set(key, newRow)
      }

      if (send1h) reminder1hCount++
      else reminder24hCount++
    }
  }

  return NextResponse.json({
    completed: completedCount,
    reminder10: reminder10Count,
    reminder60: reminder60Count,
    reminder24h: reminder24hCount,
    reminder1h: reminder1hCount,
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
