import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getLessonRequestById, getOccurrencesByLessonRequest, createLessonOccurrence, updateLessonOccurrence,
  getParentProfile, getTutorByUserId,
} from '@/lib/sheets'
import { expandLessonRequestOccurrences, applyOccurrenceOverrides } from '@/lib/schedule'
import { isTerminalOccurrence } from '@/lib/lessons'
import {
  sendEmail, lessonTimeProposedEmailHtml, lessonTimeProposalDecisionEmailHtml, lessonTimeOverriddenEmailHtml,
} from '@/lib/email'
import type { LessonOccurrence } from '@/lib/types'
import { randomUUID } from 'crypto'

const ACTIONS = ['propose', 'approve', 'decline', 'override'] as const
type Action = typeof ACTIONS[number]

// Addressed by {lessonRequestId (path id), occurrenceDate} like the existing
// /api/tutor/occurrences — most future occurrences of a recurring series
// aren't materialized as rows yet, so a row id can't be the key.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || (session.role !== 'tutor' && session.role !== 'parent')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { occurrenceDate, action, proposedDate, proposedStartTime, proposedEndTime } = body as {
    occurrenceDate: string
    action: string
    proposedDate?: string
    proposedStartTime?: string
    proposedEndTime?: string
  }

  if (!occurrenceDate || !ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400 })
  }
  const act = action as Action

  const booking = await getLessonRequestById(id)
  if (!booking) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const isTutor = session.role === 'tutor' && booking.tutorUserId === session.userId
  const isParent = session.role === 'parent' && booking.parentUserId === session.userId
  if (!isTutor && !isParent) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  if (act === 'override' && !isTutor) {
    return NextResponse.json({ error: 'Only the tutor can override a lesson time.' }, { status: 403 })
  }

  if (!booking.acceptedAt) {
    return NextResponse.json({ error: 'Accept this booking before proposing a schedule change.' }, { status: 400 })
  }

  const dayStart = new Date(`${occurrenceDate}T00:00:00`)
  const isRealOccurrence = expandLessonRequestOccurrences(booking, dayStart, dayStart).length > 0
  if (!isRealOccurrence) {
    return NextResponse.json({ error: 'Not a scheduled occurrence of this booking.' }, { status: 400 })
  }

  const occurrences = await getOccurrencesByLessonRequest(id)
  const existing = occurrences.find(o => o.occurrenceDate === occurrenceDate)
  if (existing && isTerminalOccurrence(existing.status)) {
    return NextResponse.json({ error: `This occurrence was already marked ${existing.status}.` }, { status: 400 })
  }

  const [effective] = applyOccurrenceOverrides(
    [{ date: occurrenceDate, startTime: booking.requestedStartTime, endTime: booking.requestedEndTime }],
    id,
    occurrences,
  )
  const effectiveStart = new Date(`${effective.date}T${effective.startTime}:00`)
  const hoursUntil = (effectiveStart.getTime() - Date.now()) / (60 * 60 * 1000)

  const role: 'parent' | 'tutor' = session.role as 'parent' | 'tutor'

  if (act === 'propose' || act === 'override') {
    if (!proposedDate || !proposedStartTime || !proposedEndTime) {
      return NextResponse.json({ error: 'proposedDate, proposedStartTime, and proposedEndTime are required.' }, { status: 400 })
    }
    if (proposedStartTime >= proposedEndTime) {
      return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 })
    }
    // Only a *proposal* (needs the other party's approval) is blocked inside
    // 48 hours — an override applies immediately with just an FYI email, so
    // there's no risk of it getting stuck unresolved right before the lesson.
    // Parents can never override (see the isTutor check above), so this
    // can't be used to dodge the 48h gate from the parent side.
    if (act === 'propose' && hoursUntil <= 48) {
      return NextResponse.json({ error: 'Too close to the lesson to reschedule — cancel it instead.' }, { status: 400 })
    }
    if (act === 'override' && hoursUntil <= 0) {
      return NextResponse.json({ error: "Can't override a lesson that's already started." }, { status: 400 })
    }
  }

  if (act === 'propose' && existing?.proposedBy) {
    return NextResponse.json({ error: 'A time change is already pending on this lesson.' }, { status: 400 })
  }
  if ((act === 'approve' || act === 'decline') && !existing?.proposedBy) {
    return NextResponse.json({ error: 'No pending time change to respond to.' }, { status: 400 })
  }
  if ((act === 'approve' || act === 'decline') && existing!.proposedBy === role) {
    return NextResponse.json({ error: 'You can’t respond to your own proposal.' }, { status: 403 })
  }

  const parent = await getParentProfile(booking.parentUserId)
  const tutor = await getTutorByUserId(booking.tutorUserId)
  if (!parent || !tutor) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  let patch: Partial<LessonOccurrence>
  if (act === 'propose') {
    patch = { proposedDate, proposedStartTime, proposedEndTime, proposedBy: role }
  } else if (act === 'override') {
    patch = {
      occurrenceStartTime: proposedStartTime, occurrenceEndTime: proposedEndTime,
      rescheduledDate: proposedDate !== occurrenceDate ? proposedDate : '',
      proposedDate: '', proposedStartTime: '', proposedEndTime: '', proposedBy: '',
    }
  } else if (act === 'approve') {
    const p = existing!
    patch = {
      occurrenceStartTime: p.proposedStartTime, occurrenceEndTime: p.proposedEndTime,
      rescheduledDate: p.proposedDate !== occurrenceDate ? p.proposedDate : '',
      proposedDate: '', proposedStartTime: '', proposedEndTime: '', proposedBy: '',
    }
  } else {
    patch = { proposedDate: '', proposedStartTime: '', proposedEndTime: '', proposedBy: '' }
  }

  let occurrence: LessonOccurrence
  if (existing) {
    const updated = await updateLessonOccurrence(existing.id, patch)
    if (!updated) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
    occurrence = updated
  } else {
    const base: LessonOccurrence = {
      id: `occ_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      lessonRequestId: id,
      tutorUserId: booking.tutorUserId,
      parentUserId: booking.parentUserId,
      occurrenceDate,
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
      ...patch,
    }
    await createLessonOccurrence(base)
    occurrence = base
  }

  try {
    const dashboardUrl = (r: 'parent' | 'tutor') => new URL(r === 'parent' ? '/dashboard/parent' : '/dashboard/tutor', request.url).toString()
    if (act === 'propose') {
      const recipient = role === 'parent' ? tutor : parent
      const recipientRole: 'parent' | 'tutor' = role === 'parent' ? 'tutor' : 'parent'
      await sendEmail({
        to: recipient.email,
        subject: `${session.name} suggested a new time for ${booking.childName}'s lesson`,
        html: lessonTimeProposedEmailHtml({
          recipientName: recipient.name,
          proposerName: session.name,
          childName: booking.childName,
          oldDate: effective.date,
          oldStartTime: effective.startTime,
          oldEndTime: effective.endTime,
          proposedDate: proposedDate!,
          proposedStartTime: proposedStartTime!,
          proposedEndTime: proposedEndTime!,
          dashboardUrl: dashboardUrl(recipientRole),
        }),
      })
    } else if (act === 'approve' || act === 'decline') {
      const proposerRole = existing!.proposedBy as 'parent' | 'tutor'
      const proposer = proposerRole === 'parent' ? parent : tutor
      await sendEmail({
        to: proposer.email,
        subject: `${session.name} ${act === 'approve' ? 'approved' : 'declined'} your suggested time`,
        html: lessonTimeProposalDecisionEmailHtml({
          recipientName: proposer.name,
          responderName: session.name,
          childName: booking.childName,
          decision: act === 'approve' ? 'approved' : 'declined',
          dashboardUrl: dashboardUrl(proposerRole),
        }),
      })
    } else {
      await sendEmail({
        to: parent.email,
        subject: `Your lesson time changed`,
        html: lessonTimeOverriddenEmailHtml({
          parentName: parent.name,
          tutorName: tutor.name,
          childName: booking.childName,
          oldDate: effective.date,
          oldStartTime: effective.startTime,
          oldEndTime: effective.endTime,
          newDate: proposedDate!,
          newStartTime: proposedStartTime!,
          newEndTime: proposedEndTime!,
          dashboardUrl: dashboardUrl('parent'),
        }),
      })
    }
  } catch (err) {
    console.error('[lessons/[id]/occurrences] failed to send email', err)
  }

  return NextResponse.json({ ok: true, occurrence })
}
