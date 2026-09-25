export type Role = 'parent' | 'tutor' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  passwordHash: string
  createdAt: string
}

export interface Child {
  name: string
  grade: string
  instruments: string[]
}

export interface ParentProfile {
  userId: string
  email: string
  name: string
  children: Child[]
}

export interface TutorProfile {
  userId: string
  email: string
  name: string
  instruments: string[]
  bio: string
  school: string
  credentials: string
  location: string
  photoUrl: string
  lessonsCompleted: number
  hoursCompleted: number
  rating: number
}

// Returned by GET /api/tutors — lessonsCompleted/hoursCompleted/rating are
// recomputed fresh from LessonRequests/Reviews (see lib/lessons.ts), overriding
// the static TutorProfiles columns; reviewCount has no column of its own.
export interface TutorProfileWithStats extends TutorProfile {
  reviewCount: number
}

export interface SessionPayload {
  userId: string
  email: string
  name: string
  role: Role
}

export interface TutorAvailabilityRule {
  id: string
  tutorUserId: string
  startTime: string         // HH:MM 24-hour
  endTime: string           // HH:MM 24-hour
  repeatType: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  repeatInterval: number    // "every N [units]"
  repeatDays: string[]      // ['Mon','Wed','Fri'] for weekly; empty otherwise
  endsType: 'never' | 'on' | 'after'
  endsDate: string          // ISO date, only when endsType='on'; else ''
  endsAfterCount: number    // only when endsType='after'; else 0
  createdAt: string
}

// A 'booked' row is system-written only (never via the manual Exception
// form) — one per *recurring* live LessonRequest (repeatType !== 'once'),
// created/updated/deleted alongside that booking's own lifecycle (see
// materializeFirstOccurrence / deleteBookingException in
// lib/booking-completion.ts) so the tutor's own weekly schedule view can show
// it. It is NOT read by getAvailableWindows/getBookedIntervals — those stay
// derived live from LessonRequests+Lessons, so a sync bug here can only ever
// produce a stale-looking grid cell, never an actual double-booking.
// One-time bookings don't get a 'booked' row — they're date-specific, not
// part of the *weekly* pattern this row exists to represent, and are already
// visible via the Upcoming Lessons panels.
export interface AvailabilityException {
  id: string
  tutorUserId: string
  startDate: string         // ISO date — first day of the blocked range; for 'booked', the booking's anchor date
  endDate: string           // ISO date — last day of the blocked range (same as startDate for single-day blocks); for 'booked', same as startDate (the real recurrence end is `endsDate` below)
  type: 'blocked' | 'modified' | 'booked'
  startTime: string         // HH:MM, only when type='modified'|'booked'; else ''
  endTime: string           // HH:MM, only when type='modified'|'booked'; else ''
  createdAt: string
  // Only set when type='booked' — the recurrence rule mirrors the owning
  // LessonRequest's own shape exactly. Blank/0 for 'blocked'|'modified' rows.
  repeatType: 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | ''
  repeatInterval: number
  repeatDays: string[]
  endsType: 'never' | 'on' | 'after' | ''
  endsDate: string          // ISO date, only when endsType='on'; else ''
  endsAfterCount: number    // only when endsType='after'; else 0
  // Only set when type='booked' — the LessonRequest this row mirrors. Lets
  // an edit/cancel find-and-update/delete the right row. '' for manual rows.
  sourceLessonRequestId: string
}

// A LessonRequest is the booking/series: status describes the booking
// relationship's lifecycle (pending -> in_progress -> complete|cancelled).
// For a recurring booking (repeatType !== 'once'), status never reaches
// 'complete' — a series doesn't have one completion moment, individual
// LessonOccurrences do. requestedDate/Start/EndTime is the first occurrence
// and doubles as the recurrence anchor, same role createdAt plays for
// TutorAvailabilityRule.
export interface LessonRequest {
  id: string
  parentUserId: string
  childName: string
  tutorUserId: string
  requestedDate: string       // ISO date YYYY-MM-DD
  requestedStartTime: string  // HH:MM
  requestedEndTime: string    // HH:MM
  message: string
  status: 'pending' | 'in_progress' | 'complete' | 'cancelled'
  initiatedBy: 'parent' | 'tutor'
  createdAt: string
  updatedAt: string
  repeatType: 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  repeatInterval: number
  repeatDays: string[]
  endsType: 'never' | 'on' | 'after'
  endsDate: string
  endsAfterCount: number
  // '' = not yet accepted. Deliberately NOT a status value (see
  // isHistoryBooking in lib/lessons.ts) — status keeps meaning exactly what
  // it always has; this only gates whether a live LessonOccurrence exists.
  acceptedAt: string
  // Tutor's required reason for declining a not-yet-accepted request; '' for
  // every other cancellation (self-withdrawal, cancelling an already-live series).
  declineReason: string
}

// A row is only ever created once something needs to be tracked about a
// specific occurrence: the moment its first pre-lesson reminder fires
// ('upcoming'), or once it reaches a terminal state ('completed'/'cancelled'/
// 'no_show'). Occurrences with nothing to track yet are never pre-generated —
// they're always computed live from the parent LessonRequest's recurrence
// fields (see lib/schedule.ts). Use lib/lessons.ts's isTerminalOccurrence()
// to distinguish "has a row" from "is resolved".
export interface LessonOccurrence {
  id: string
  lessonRequestId: string
  tutorUserId: string
  parentUserId: string
  occurrenceDate: string        // YYYY-MM-DD
  occurrenceStartTime: string   // HH:MM
  occurrenceEndTime: string     // HH:MM
  status: 'upcoming' | 'completed' | 'cancelled' | 'no_show'
  completedAt: string   // scheduled end (auto) or manual-completion time; '' if not completed
  summary: string       // '' until the tutor writes it; also doubles as an optional no-show/cancel note
  reminder24hSentAt: string  // pre-lesson, sent to both parent + tutor
  reminder1hSentAt: string   // pre-lesson, sent to both parent + tutor
  reminder10SentAt: string   // post-completion, tutor-only "write your summary" nag
  reminder60SentAt: string   // post-completion, tutor-only "write your summary" nag
  createdAt: string
  // A pending reschedule proposal — '' fields mean no proposal is pending.
  // The *other* party (never proposedBy) may approve/decline it.
  proposedDate: string
  proposedStartTime: string
  proposedEndTime: string
  proposedBy: 'parent' | 'tutor' | ''
  // Set once a reschedule is approved/overridden AND lands on a different
  // calendar day. occurrenceDate stays the lookup key everything else keys
  // off (cron, etc.) — it must never be overwritten to the new date, so the
  // new date goes here instead. occurrenceStartTime/EndTime double as the
  // effective time once applied (nothing else keys off them).
  rescheduledDate: string
}

// Legacy rows (created before the add-student approval flow existed) decode
// with status defaulting to 'approved' and proposedLesson* defaulting to ''
// — see rowToTutorStudent in lib/sheets.ts. That's a deliberate grandfather-
// in, not a placeholder to backfill.
export interface TutorStudent {
  id: string
  tutorUserId: string
  parentUserId: string
  childName: string
  addedAt: string
  status: 'pending' | 'approved' | 'rejected'
  proposedLessonDate: string       // '' if no next lesson was proposed
  proposedLessonStartTime: string
  proposedLessonEndTime: string
  // The recurrence rule for proposedLessonDate, same anchor+rule shape as
  // LessonRequest. Defaults to 'once' — a tutor never has to set up a
  // schedule at all when adding a student, and a single proposed lesson
  // with no recurrence is exactly 'once' with these left at their defaults.
  proposedRepeatType: 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  proposedRepeatInterval: number
  proposedRepeatDays: string[]
  proposedEndsType: 'never' | 'on' | 'after'
  proposedEndsDate: string
  proposedEndsAfterCount: number
}

// A review is of the tutor's teaching overall, not of any single lesson —
// one review per (tutorUserId, parentUserId) pair.
export interface Review {
  id: string
  tutorUserId: string
  parentUserId: string
  rating: number   // 1-5 integer
  comment: string
  createdAt: string
}

export interface Slot {
  date: string       // YYYY-MM-DD
  startTime: string  // HH:MM
  endTime: string    // HH:MM
}
