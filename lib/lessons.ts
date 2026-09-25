import type { LessonRequest, LessonOccurrence, Review } from './types'

// Legal current-status -> target-status transitions for a lesson request.
// pending -> cancelled covers "decline before ever accepting".
const TRANSITIONS: Record<LessonRequest['status'], LessonRequest['status'][]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['complete', 'cancelled'],
  complete: [],
  cancelled: [],
}

export function canTransitionLessonStatus(
  from: LessonRequest['status'],
  to: LessonRequest['status'],
): boolean {
  return TRANSITIONS[from].includes(to)
}

// A tutor-initiated request sitting in 'pending' is a proposal only the
// parent may accept/reject — the tutor can withdraw it (pending->cancelled)
// but must not be able to self-approve it (pending->in_progress). A blank
// legacy initiatedBy decodes as 'parent' (see rowToLessonRequest), so this
// also fails closed for old rows instead of ever letting a parent
// self-approve their own request.
//
// NOTE: as of the "tutor-initiated lessons finalize instantly" change,
// POST /api/tutor/schedule-lesson no longer creates rows this can match —
// new tutor-initiated requests are created directly as status:'in_progress'
// with acceptedAt already set. Kept only for pre-existing pending rows
// already in the live sheet; don't remove without confirming none remain
// (never backfill/migrate the sheet to check — leave this dead path in place).
export function isAwaitingParentApproval(
  req: Pick<LessonRequest, 'status' | 'initiatedBy'>,
): boolean {
  return req.status === 'pending' && req.initiatedBy === 'tutor'
}

// Presentation-layer only — status keeps meaning exactly what it always has
// (pending -> in_progress -> complete|cancelled); acceptance is tracked by a
// separate field (acceptedAt) precisely so this classification never has to
// change what any status==='in_progress' filter means elsewhere (double-
// booking prevention, computeNextOccurrence, cron's active-bookings filter).
export function isHistoryBooking(
  req: Pick<LessonRequest, 'status' | 'acceptedAt'>,
): boolean {
  return req.status === 'complete' || req.status === 'cancelled'
    || (req.status === 'in_progress' && !!req.acceptedAt)
}

// Distinguishes "this occurrence has a row" from "this occurrence is
// resolved" — a row can also exist in 'upcoming' status purely to track a
// pre-lesson reminder that's already been sent.
export function isTerminalOccurrence(status: LessonOccurrence['status']): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'no_show'
}

// Pure HH:MM diff in hours. Assumes a same-day, non-overnight range (end > start),
// consistent with how requestedStartTime/requestedEndTime are used elsewhere.
export function lessonDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

// Counts completed LessonOccurrences, not LessonRequest.status==='complete' —
// a recurring booking's own status never reaches 'complete' (see lib/types.ts),
// so per-occurrence rows are the only reliable source for lessons/hours taught.
export function computeTutorStats(
  tutorUserId: string,
  allOccurrences: LessonOccurrence[],
  allReviews: Review[],
): { lessonsCompleted: number; hoursCompleted: number; rating: number; reviewCount: number } {
  const completed = allOccurrences.filter(o => o.tutorUserId === tutorUserId && o.status === 'completed')
  const reviews = allReviews.filter(r => r.tutorUserId === tutorUserId)

  const lessonsCompleted = completed.length
  const hoursCompleted = completed.reduce(
    (sum, o) => sum + lessonDurationHours(o.occurrenceStartTime, o.occurrenceEndTime),
    0,
  )
  const reviewCount = reviews.length
  const rating = reviewCount > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : 0

  return { lessonsCompleted, hoursCompleted, rating, reviewCount }
}

// Presentation-only rounding of a raw hours total to ~2 significant figures
// (2.083333... -> "2.1", 100 -> "100", 0 -> "0"). Only ever call this at
// render time — never on computeTutorStats' return value or the sheet-
// mirrored hoursCompleted column, so nothing that sums/compares hours
// downstream is affected.
export function formatHours(hours: number): string {
  return String(Number(hours.toPrecision(2)))
}

// Tutors this parent has a completed occurrence with but hasn't reviewed
// yet, deduped by tutor (a review is per (tutor, parent), not per booking).
// Shared by the parent dashboard's review prompt and LessonRequestsList's
// "unreviewed" badge count — NOT used for LessonRequestsList's per-card
// show/hide logic, which additionally requires isHistoryBooking(req) since a
// tutor can have both a reviewable old booking and an unrelated new pending
// one.
export function getReviewableTutors<T extends {
  tutorUserId: string
  tutorName: string
  hasCompletedOccurrence: boolean
  review: unknown | null
}>(requests: T[]): Array<{ tutorUserId: string; tutorName: string }> {
  const seen = new Set<string>()
  const out: Array<{ tutorUserId: string; tutorName: string }> = []
  for (const r of requests) {
    if (r.hasCompletedOccurrence && !r.review && !seen.has(r.tutorUserId)) {
      seen.add(r.tutorUserId)
      out.push({ tutorUserId: r.tutorUserId, tutorName: r.tutorName })
    }
  }
  return out
}
