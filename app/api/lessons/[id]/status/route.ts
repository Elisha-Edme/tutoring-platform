import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestById, getParentProfile, getTutorByUserId, updateLessonRequest } from '@/lib/sheets'
import { canTransitionLessonStatus, isAwaitingParentApproval } from '@/lib/lessons'
import { materializeFirstOccurrence } from '@/lib/booking-completion'
import {
  sendEmail, lessonAcceptedEmailHtml, lessonCancelledEmailHtml, lessonProposalDecisionEmailHtml,
} from '@/lib/email'
import type { LessonRequest } from '@/lib/types'

// 'complete' is not a raw client-settable transition — it's an internal side
// effect of writing a lesson summary (see /api/tutor/lesson-summaries and
// /api/cron/lesson-followups), since completion is now per-occurrence.
const VALID_STATUSES = ['in_progress', 'cancelled'] as const
type UpdateableStatus = typeof VALID_STATUSES[number]

async function sendStatusEmail(request: NextRequest, updated: LessonRequest, tutorName: string) {
  const parent = await getParentProfile(updated.parentUserId)
  if (!parent) return

  const shared = {
    parentName: parent.name,
    tutorName,
    childName: updated.childName,
    requestedDate: updated.requestedDate,
    requestedStartTime: updated.requestedStartTime,
    requestedEndTime: updated.requestedEndTime,
  }

  if (updated.status === 'in_progress') {
    await sendEmail({
      to: parent.email,
      subject: `${tutorName} accepted your lesson request`,
      html: lessonAcceptedEmailHtml({ ...shared, dashboardUrl: new URL('/dashboard/parent', request.url).toString() }),
    })
  } else if (updated.status === 'cancelled') {
    await sendEmail({
      to: parent.email,
      subject: `Your lesson request was cancelled`,
      html: lessonCancelledEmailHtml({
        ...shared,
        declineReason: updated.declineReason || undefined,
        dashboardUrl: new URL('/tutors', request.url).toString(),
      }),
    })
  }
}

async function sendProposalDecisionEmail(request: NextRequest, updated: LessonRequest, parentName: string) {
  const tutor = await getTutorByUserId(updated.tutorUserId)
  if (!tutor) return
  await sendEmail({
    to: tutor.email,
    subject: `${parentName} ${updated.status === 'in_progress' ? 'approved' : 'declined'} your lesson proposal`,
    html: lessonProposalDecisionEmailHtml({
      tutorName: tutor.name,
      parentName,
      childName: updated.childName,
      requestedDate: updated.requestedDate,
      requestedStartTime: updated.requestedStartTime,
      requestedEndTime: updated.requestedEndTime,
      decision: updated.status === 'in_progress' ? 'approved' : 'declined',
      dashboardUrl: new URL('/dashboard/tutor', request.url).toString(),
    }),
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || (session.role !== 'tutor' && session.role !== 'parent')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { status, reason } = body as { status: string; reason?: string }

  if (!VALID_STATUSES.includes(status as UpdateableStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  const existing = await getLessonRequestById(id)
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  // A tutor declining a not-yet-accepted, parent-initiated request must give
  // a reason — a tutor withdrawing their own still-pending proposal isn't
  // "declining" anyone and doesn't need one.
  const decliningParentRequest = session.role === 'tutor' && status === 'cancelled'
    && !existing.acceptedAt && existing.initiatedBy === 'parent'
  if (decliningParentRequest && !reason?.trim()) {
    return NextResponse.json({ error: 'A reason is required to decline this request.' }, { status: 400 })
  }

  // A parent approving a tutor-initiated one-off proposal has no separate
  // "acknowledge" phase — the tutor already committed to a specific time —
  // so approval here graduates it straight into a live lesson, same as
  // POST /api/lessons/[id]/accept.
  const parentApprovingTutorProposal = session.role === 'parent' && status === 'in_progress'

  if (session.role === 'tutor') {
    if (existing.tutorUserId !== session.userId) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }
    // A tutor-initiated proposal can only be confirmed by the parent — a
    // tutor may still withdraw it (pending->cancelled), just not self-approve
    // it (pending->in_progress). See isAwaitingParentApproval.
    if (status === 'in_progress' && isAwaitingParentApproval(existing)) {
      return NextResponse.json(
        { error: 'This request is awaiting the parent’s approval.' },
        { status: 400 },
      )
    }
  } else {
    if (existing.parentUserId !== session.userId) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }
    // A parent may only act on a tutor-initiated proposal still awaiting
    // their decision — never on their own submitted request, and never on
    // one already accepted/declined.
    if (!isAwaitingParentApproval(existing)) {
      return NextResponse.json({ error: 'You can’t approve or decline this request.' }, { status: 403 })
    }
  }

  if (!canTransitionLessonStatus(existing.status, status as UpdateableStatus)) {
    return NextResponse.json(
      { error: `Cannot move a ${existing.status} request to ${status}.` },
      { status: 400 },
    )
  }

  const updated = await updateLessonRequest(id, {
    status: status as UpdateableStatus,
    ...(decliningParentRequest ? { declineReason: reason!.trim() } : {}),
    ...(parentApprovingTutorProposal ? { acceptedAt: new Date().toISOString() } : {}),
  })
  if (!updated) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

  if (parentApprovingTutorProposal) {
    await materializeFirstOccurrence(updated)
  }

  try {
    if (session.role === 'tutor') {
      await sendStatusEmail(request, updated, session.name)
    } else {
      await sendProposalDecisionEmail(request, updated, session.name)
    }
  } catch (err) {
    console.error('[lessons/status] failed to send email', err)
  }

  return NextResponse.json({ ok: true })
}
