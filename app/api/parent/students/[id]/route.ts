import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getTutorStudentById, updateTutorStudent, deleteTutorStudent,
  createLessonRequest,
  getLessonRequestsByParent, getOccurrencesByLessonRequest, updateLessonRequest, updateLessonOccurrence,
  getTutorByUserId,
} from '@/lib/sheets'
import { materializeFirstOccurrence } from '@/lib/booking-completion'
import { sendEmail, studentRequestDecisionEmailHtml, tutorRelationshipEndedEmailHtml } from '@/lib/email'
import type { LessonRequest } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { action } = body as { action: string }

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be "approve" or "reject".' }, { status: 400 })
  }

  const existing = await getTutorStudentById(id)
  if (!existing || existing.parentUserId !== session.userId) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'This request has already been decided.' }, { status: 400 })
  }

  const tutor = await getTutorByUserId(existing.tutorUserId)
  if (!tutor) return NextResponse.json({ error: 'Tutor not found.' }, { status: 404 })

  const proposedLessonScheduled = action === 'approve' && !!existing.proposedLessonDate

  await updateTutorStudent(id, { status: action === 'approve' ? 'approved' : 'rejected' })

  if (proposedLessonScheduled) {
    // The parent approving THIS request already is their agreement to the
    // proposed schedule — no second round-trip through the normal
    // pending->accept flow. acceptedAt is set immediately and the first
    // occurrence materialized right away, exactly like POST /api/lessons/[id]/accept,
    // since there's no separate negotiation phase for a tutor-initiated proposal.
    const now = new Date().toISOString()
    const booking: LessonRequest = {
      id: `req_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      parentUserId: existing.parentUserId,
      childName: existing.childName,
      tutorUserId: existing.tutorUserId,
      requestedDate: existing.proposedLessonDate,
      requestedStartTime: existing.proposedLessonStartTime,
      requestedEndTime: existing.proposedLessonEndTime,
      message: '',
      status: 'in_progress',
      initiatedBy: 'tutor',
      createdAt: now,
      updatedAt: now,
      repeatType: existing.proposedRepeatType,
      repeatInterval: existing.proposedRepeatInterval,
      repeatDays: existing.proposedRepeatDays,
      endsType: existing.proposedEndsType,
      endsDate: existing.proposedEndsDate,
      endsAfterCount: existing.proposedEndsAfterCount,
      acceptedAt: now,
      declineReason: '',
    }
    await createLessonRequest(booking)
    await materializeFirstOccurrence(booking)
  }

  try {
    await sendEmail({
      to: tutor.email,
      subject: `${session.name} ${action === 'approve' ? 'approved' : 'declined'} your student request`,
      html: studentRequestDecisionEmailHtml({
        tutorName: tutor.name,
        parentName: session.name,
        childName: existing.childName,
        decision: action === 'approve' ? 'approved' : 'rejected',
        proposedLessonScheduled,
        dashboardUrl: new URL('/dashboard/tutor', request.url).toString(),
      }),
    })
  } catch (err) {
    console.error('[parent/students] failed to send email', err)
  }

  return NextResponse.json({ ok: true })
}

// "Remove tutor" — unilateral, no tutor approval needed. Cancels every
// pending/in_progress LessonRequest between this exact tutor+parent+child
// triple and best-effort flips their upcoming occurrences to cancelled too.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const existing = await getTutorStudentById(id)
  if (!existing || existing.parentUserId !== session.userId) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  if (existing.status !== 'approved') {
    return NextResponse.json({ error: 'This relationship is not currently approved.' }, { status: 400 })
  }

  await deleteTutorStudent(existing.tutorUserId, existing.parentUserId, existing.childName)

  const requests = await getLessonRequestsByParent(session.userId)
  const affected = requests.filter(
    r => r.tutorUserId === existing.tutorUserId && r.childName === existing.childName
      && (r.status === 'pending' || r.status === 'in_progress'),
  )
  for (const r of affected) {
    try {
      await updateLessonRequest(r.id, { status: 'cancelled' })
      const occurrences = await getOccurrencesByLessonRequest(r.id)
      for (const occ of occurrences) {
        if (occ.status === 'upcoming') await updateLessonOccurrence(occ.id, { status: 'cancelled' })
      }
    } catch (err) {
      console.error('[parent/students] failed to cancel a lesson while removing tutor', err)
    }
  }

  try {
    const tutor = await getTutorByUserId(existing.tutorUserId)
    if (tutor) {
      await sendEmail({
        to: tutor.email,
        subject: `${session.name} removed you as ${existing.childName}'s tutor`,
        html: tutorRelationshipEndedEmailHtml({
          tutorName: tutor.name,
          parentName: session.name,
          childName: existing.childName,
          dashboardUrl: new URL('/dashboard/tutor', request.url).toString(),
        }),
      })
    }
  } catch (err) {
    console.error('[parent/students] failed to send removal email', err)
  }

  return NextResponse.json({ ok: true })
}
