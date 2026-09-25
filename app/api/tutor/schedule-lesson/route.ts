import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLessonRequest, getParentProfile, getTutorStudentsByTutor } from '@/lib/sheets'
import { describeLessonRecurrence } from '@/lib/schedule'
import { sendEmail, lessonScheduledEmailHtml } from '@/lib/email'
import { materializeFirstOccurrence } from '@/lib/booking-completion'
import type { LessonRequest } from '@/lib/types'
import { randomUUID } from 'crypto'

// The tutor-initiated counterpart to /api/lessons/request — a tutor
// scheduling further lessons with an already-approved student (see
// app/api/tutor/students for how that relationship is established). This is
// instant-confirm: the tutor already committed to a specific time, so it's
// created straight into status:'in_progress' with acceptedAt set and its
// first occurrence materialized immediately — the same "no separate
// negotiation for a tutor-initiated proposal" reasoning as a parent
// approving an add-student proposal with an attached schedule (see PATCH
// /api/parent/students/[id]).
//
// isAwaitingParentApproval() and the PUT /api/lessons/[id]/status branches
// keyed off it are now unreachable for *new* rows created here, but are
// intentionally left in place for any pre-existing pending, initiatedBy:
// 'tutor' rows already in the live sheet — this repo never backfills/
// migrates existing sheet data.
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    parentUserId,
    childName,
    requestedDate,
    requestedStartTime,
    requestedEndTime,
    repeatType = 'once',
    repeatInterval = 1,
    repeatDays = [],
    endsType = 'never',
    endsDate = '',
    endsAfterCount = 0,
  } = body

  if (!parentUserId || !childName || !requestedDate || !requestedStartTime || !requestedEndTime) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const profile = await getParentProfile(parentUserId)
  if (!profile) {
    return NextResponse.json({ error: 'Parent not found.' }, { status: 404 })
  }
  if (!profile.children.some(c => c.name === childName)) {
    return NextResponse.json({ error: 'Child not found under that parent.' }, { status: 404 })
  }

  const students = await getTutorStudentsByTutor(session.userId)
  const isApprovedStudent = students.some(
    s => s.parentUserId === parentUserId && s.childName === childName && s.status === 'approved',
  )
  if (!isApprovedStudent) {
    return NextResponse.json(
      { error: 'You don’t have an approved relationship with that student yet.' },
      { status: 403 },
    )
  }

  const now = new Date().toISOString()
  const booking: LessonRequest = {
    id: `req_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    parentUserId,
    childName,
    tutorUserId: session.userId,
    requestedDate,
    requestedStartTime,
    requestedEndTime,
    message: '',
    status: 'in_progress',
    initiatedBy: 'tutor',
    acceptedAt: now,
    declineReason: '',
    createdAt: now,
    updatedAt: now,
    repeatType,
    repeatInterval,
    repeatDays,
    endsType,
    endsDate,
    endsAfterCount,
  }
  await createLessonRequest(booking)
  await materializeFirstOccurrence(booking)

  try {
    await sendEmail({
      to: profile.email,
      subject: `${session.name} scheduled a lesson with ${childName}`,
      html: lessonScheduledEmailHtml({
        parentName: profile.name,
        tutorName: session.name,
        childName,
        requestedDate,
        requestedStartTime,
        requestedEndTime,
        recurrenceLabel: describeLessonRecurrence(booking),
        dashboardUrl: new URL('/dashboard/parent', request.url).toString(),
      }),
    })
  } catch (err) {
    console.error('[tutor/schedule-lesson] failed to send email', err)
  }

  return NextResponse.json({ ok: true, bookingId: booking.id })
}
