// Unlike lib/lessons.ts (pure, no I/O), this file explicitly performs Sheets
// writes and email sends — the same carve-out lib/email.ts gets for touching
// nodemailer. It exists to de-duplicate the one side effect shared by the
// manual "write a summary early" path and the cron auto-completer.
import {
  getParentProfile, getTutorByUserId, updateLessonRequest, updateTutorProfile, createLessonOccurrence,
  createAvailabilityException, getExceptionBySourceLessonRequestId, deleteAvailabilityException,
} from './sheets'
import { sendEmail, lessonCompletedEmailHtml, lessonCancelledEmailHtml, lessonCancelledByParentEmailHtml } from './email'
import type { LessonRequest, LessonOccurrence } from './types'
import { randomUUID } from 'crypto'

// The one piece of state shared by every "graduate a negotiated request into
// a live lesson" path: POST /api/lessons/[id]/accept, a parent approving a
// tutor-initiated one-off proposal, and a parent approving an add-student
// proposal with an attached schedule. None of them have a separate
// "acknowledge" phase once this fires — the caller is responsible for also
// setting acceptedAt on the booking itself.
export async function materializeFirstOccurrence(booking: LessonRequest): Promise<void> {
  const occurrence: LessonOccurrence = {
    id: `occ_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    lessonRequestId: booking.id,
    tutorUserId: booking.tutorUserId,
    parentUserId: booking.parentUserId,
    occurrenceDate: booking.requestedDate,
    occurrenceStartTime: booking.requestedStartTime,
    occurrenceEndTime: booking.requestedEndTime,
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
  }
  await createLessonOccurrence(occurrence)
  await createBookingException(booking)
}

// Mirrors a *recurring* booking's schedule into a system-owned
// AvailabilityException row (type='booked') so the tutor's own weekly
// schedule view can show it — see that type's doc comment in lib/types.ts
// for why one-time bookings don't get one, and why this is never read by
// getAvailableWindows/getBookedIntervals (display-only, not load-bearing for
// double-booking prevention). Called once, at the single choke point every
// "this booking is now live" path already funnels through.
async function createBookingException(booking: LessonRequest): Promise<void> {
  if (booking.repeatType === 'once') return
  await createAvailabilityException({
    id: `exc_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    tutorUserId: booking.tutorUserId,
    startDate: booking.requestedDate,
    endDate: booking.requestedDate,
    type: 'booked',
    startTime: booking.requestedStartTime,
    endTime: booking.requestedEndTime,
    createdAt: new Date().toISOString(),
    repeatType: booking.repeatType,
    repeatInterval: booking.repeatInterval,
    repeatDays: booking.repeatDays,
    endsType: booking.endsType,
    endsDate: booking.endsDate,
    endsAfterCount: booking.endsAfterCount,
    sourceLessonRequestId: booking.id,
  })
}

// Removes the 'booked' AvailabilityException row mirroring `lessonRequestId`,
// if one exists (only recurring bookings ever get one). Called when a
// recurring series is cancelled (PUT /api/lessons/[id]/status). A no-op for
// one-time bookings, which never had a row to begin with.
export async function deleteBookingException(lessonRequestId: string): Promise<void> {
  const exc = await getExceptionBySourceLessonRequestId(lessonRequestId)
  if (exc) await deleteAvailabilityException(exc.id)
}

// If `booking` is a one-time (non-recurring) booking, flip it to 'complete'
// and send the parent the existing "leave a review" email. A no-op for
// recurring bookings — their own status never reaches 'complete' (see
// lib/types.ts); individual occurrences do instead.
export async function completeOnceBookingIfApplicable(
  booking: LessonRequest,
  tutorName: string,
  occurrenceDate: string,
  reviewUrl: string,
): Promise<void> {
  if (booking.repeatType !== 'once') return

  await updateLessonRequest(booking.id, { status: 'complete' })

  try {
    const parent = await getParentProfile(booking.parentUserId)
    if (!parent) return
    await sendEmail({
      to: parent.email,
      subject: `How was the lesson with ${tutorName}?`,
      html: lessonCompletedEmailHtml({
        parentName: parent.name,
        tutorName,
        childName: booking.childName,
        requestedDate: occurrenceDate,
        reviewUrl,
      }),
    })
  } catch (err) {
    console.error('[booking-completion] failed to send review-invite email', err)
  }
}

// If `booking` is a one-time booking, flip it to 'complete' (the scheduled
// session concluded, just unsuccessfully) — but skip the "leave a review"
// email; asking for a review right after a no-show reads oddly. No parent
// email either — this is retrospective, no action needed from them.
export async function noShowOnceBookingIfApplicable(booking: LessonRequest): Promise<void> {
  if (booking.repeatType !== 'once') return
  await updateLessonRequest(booking.id, { status: 'complete' })
}

// If `booking` is a one-time booking, flip it straight to 'cancelled' and
// email the *other* party — unlike a no-show, a cancellation is something
// they need to know before the lesson time so they don't show up. Either
// the tutor or the parent may be the one cancelling now (see
// POST /api/tutor/occurrences), so the recipient/template depend on who did it.
export async function cancelOnceBookingIfApplicable(
  booking: LessonRequest,
  actorName: string,
  actorRole: 'tutor' | 'parent',
  dashboardUrl: string,
): Promise<void> {
  if (booking.repeatType !== 'once') return
  await updateLessonRequest(booking.id, { status: 'cancelled' })

  try {
    if (actorRole === 'tutor') {
      const parent = await getParentProfile(booking.parentUserId)
      if (!parent) return
      await sendEmail({
        to: parent.email,
        subject: `Your lesson request was cancelled`,
        html: lessonCancelledEmailHtml({
          parentName: parent.name,
          tutorName: actorName,
          childName: booking.childName,
          requestedDate: booking.requestedDate,
          requestedStartTime: booking.requestedStartTime,
          requestedEndTime: booking.requestedEndTime,
          dashboardUrl,
        }),
      })
    } else {
      const tutor = await getTutorByUserId(booking.tutorUserId)
      if (!tutor) return
      await sendEmail({
        to: tutor.email,
        subject: `${actorName} cancelled an upcoming lesson`,
        html: lessonCancelledByParentEmailHtml({
          tutorName: tutor.name,
          parentName: actorName,
          childName: booking.childName,
          requestedDate: booking.requestedDate,
          requestedStartTime: booking.requestedStartTime,
          requestedEndTime: booking.requestedEndTime,
          dashboardUrl,
        }),
      })
    }
  } catch (err) {
    console.error('[booking-completion] failed to send cancellation email', err)
  }
}

// Best-effort mirror of computeTutorStats' live-computed number, so anyone
// viewing the raw sheet doesn't see permanently-stuck zeros. Non-blocking —
// the dynamic computation stays the authoritative source for the app itself.
export async function incrementTutorStats(tutorUserId: string, durationHours: number): Promise<void> {
  try {
    const tutor = await getTutorByUserId(tutorUserId)
    if (!tutor) return
    await updateTutorProfile(tutorUserId, {
      lessonsCompleted: tutor.lessonsCompleted + 1,
      hoursCompleted: tutor.hoursCompleted + durationHours,
    })
  } catch (err) {
    console.error('[booking-completion] failed to increment tutor stats', err)
  }
}
