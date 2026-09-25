// Impure — hits Sheets, same category as lib/booking-completion.ts (unlike
// lib/schedule.ts, which is pure math with no I/O). Exists so every write
// path that creates or edits a tutor's commitment can check for a scheduling
// conflict the same way the read-side booking flow already computes
// availability, instead of only filtering what's *shown* and trusting the
// write blindly.
import { getAvailabilityRulesByTutor, getExceptionsByTutor, getLessonRequestsByTutor, getOccurrencesByTutor } from './sheets'
import { getAvailableWindows, getBookedIntervals, expandLessonRequestOccurrences, isRangeWithinWindows } from './schedule'
import type { LessonRequest } from './types'

// This tutor's available windows in [from, to] — their availability rules,
// minus manual exceptions, minus time already reserved by other active
// bookings. `excludeLessonRequestId` lets an edit re-check its own new
// schedule without conflicting with its own current occurrences.
// `excludeBooked: false` skips the booked-time subtraction entirely — used
// by TutorAvailabilityPreview, which collapses many weeks onto one 7-day
// shape, where excluding booked time would blank out every occurrence of
// that weekday instead of just the one actually booked.
export async function computeTutorAvailableWindows(
  tutorUserId: string,
  from: Date,
  to: Date,
  options?: { excludeLessonRequestId?: string; excludeBooked?: boolean },
): Promise<Array<{ date: string; startTime: string; endTime: string }>> {
  const excludeBooked = options?.excludeBooked ?? true

  const [rules, exceptions] = await Promise.all([
    getAvailabilityRulesByTutor(tutorUserId),
    getExceptionsByTutor(tutorUserId),
  ])

  let booked: Array<{ date: string; startTime: string; endTime: string }> = []
  if (excludeBooked) {
    const [requests, occurrences] = await Promise.all([
      getLessonRequestsByTutor(tutorUserId),
      getOccurrencesByTutor(tutorUserId),
    ])
    const activeBookings = requests.filter(
      r => r.status === 'in_progress' && r.id !== options?.excludeLessonRequestId,
    )
    booked = getBookedIntervals(activeBookings, occurrences, from, to)
  }

  return getAvailableWindows(rules, exceptions, from, to, booked)
}

type SchedulingCandidate = Pick<LessonRequest,
  'requestedDate' | 'requestedStartTime' | 'requestedEndTime'
  | 'repeatType' | 'repeatInterval' | 'repeatDays' | 'endsType' | 'endsDate' | 'endsAfterCount'
>

// Rejects a candidate booking (one-time or recurring) if any occurrence it
// would generate falls outside the tutor's available windows or overlaps an
// existing active booking. excludeLessonRequestId lets an edit re-check its
// own new schedule without conflicting with its own current occurrences.
// Returns the first conflicting occurrence, or null if the whole candidate
// is free. Every write path that creates/edits a tutor's commitment should
// call this before writing — see the routes listed in the plan doc.
export async function findSchedulingConflict(
  tutorUserId: string,
  candidate: SchedulingCandidate,
  excludeLessonRequestId?: string,
): Promise<{ date: string; startTime: string; endTime: string } | null> {
  const from = new Date(`${candidate.requestedDate}T00:00:00`)
  // Bound the horizon so an endsType:'never' recurring candidate doesn't
  // expand indefinitely — matches the 365-day lookahead convention already
  // used elsewhere (e.g. computeNextOccurrence). endsType:'after' is already
  // self-limiting inside expandRule regardless of this bound.
  const oneYearOut = new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000)
  const to = candidate.endsType === 'on' && candidate.endsDate
    ? new Date(Math.min(new Date(`${candidate.endsDate}T00:00:00`).getTime(), oneYearOut.getTime()))
    : oneYearOut

  const candidateOccurrences = expandLessonRequestOccurrences(candidate, from, to)
  if (candidateOccurrences.length === 0) return null

  const windows = await computeTutorAvailableWindows(tutorUserId, from, to, { excludeLessonRequestId })
  const windowsByDate = new Map<string, Array<{ startTime: string; endTime: string }>>()
  for (const w of windows) {
    const arr = windowsByDate.get(w.date) ?? []
    arr.push({ startTime: w.startTime, endTime: w.endTime })
    windowsByDate.set(w.date, arr)
  }

  for (const occ of candidateOccurrences) {
    const dayWindows = windowsByDate.get(occ.date) ?? []
    if (!isRangeWithinWindows(occ.startTime, occ.endTime, dayWindows)) {
      return { date: occ.date, startTime: occ.startTime, endTime: occ.endTime }
    }
  }
  return null
}
