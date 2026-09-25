import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestsByParent, getTutorByUserId, getReviewsByParent, getOccurrencesByParent } from '@/lib/sheets'
import { expandLessonRequestOccurrences, applyOccurrenceOverrides, describeLessonRecurrence } from '@/lib/schedule'
import { isTerminalOccurrence } from '@/lib/lessons'
import type { LessonRequest, LessonOccurrence } from '@/lib/types'

// Mirrors the same helper in app/api/tutor/requests/route.ts.
function computeNextOccurrence(booking: LessonRequest, allOccurrences: LessonOccurrence[]) {
  if (booking.status !== 'in_progress') return null
  const bookingOccurrences = allOccurrences.filter(o => o.lessonRequestId === booking.id)
  const resolvedDates = new Set(
    bookingOccurrences.filter(o => isTerminalOccurrence(o.status)).map(o => o.occurrenceDate),
  )
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const to = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  const template = expandLessonRequestOccurrences(booking, from, to)
  const effective = applyOccurrenceOverrides(template, booking.id, bookingOccurrences)
  const next = effective.find(o => !resolvedDates.has(o.templateDate))
  return next ? { date: next.date, startTime: next.startTime, endTime: next.endTime } : null
}

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [requests, reviews, occurrences] = await Promise.all([
    getLessonRequestsByParent(session.userId),
    getReviewsByParent(session.userId),
    getOccurrencesByParent(session.userId),
  ])
  requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // Enrich with tutor names (tutorEmail is stored but name is friendlier in UI).
  const tutorIds = [...new Set(requests.map(r => r.tutorUserId))]
  const tutorMap: Record<string, string> = {}
  await Promise.all(
    tutorIds.map(async id => {
      const t = await getTutorByUserId(id)
      if (t) tutorMap[id] = t.name
    }),
  )

  // Reviews are per (tutor, parent), not per lesson request — every request row
  // for a given tutor shares the same review once the parent has left one.
  const reviewMap: Record<string, { rating: number; comment: string; createdAt: string }> = {}
  for (const r of reviews) reviewMap[r.tutorUserId] = { rating: r.rating, comment: r.comment, createdAt: r.createdAt }

  // Review eligibility is per tutor, not per LessonRequest.status — a
  // recurring booking's own status never reaches 'complete'.
  const completedTutorIds = new Set(
    occurrences.filter(o => o.status === 'completed').map(o => o.tutorUserId),
  )

  const enriched = requests.map(r => ({
    ...r,
    tutorName: tutorMap[r.tutorUserId] ?? '',
    review: reviewMap[r.tutorUserId] ?? null,
    hasCompletedOccurrence: completedTutorIds.has(r.tutorUserId),
    recurrenceLabel: describeLessonRecurrence(r),
    occurrences: occurrences
      .filter(o => o.lessonRequestId === r.id)
      .sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate)),
    nextOccurrence: computeNextOccurrence(r, occurrences),
  }))

  return NextResponse.json({ requests: enriched })
}
