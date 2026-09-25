import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestById, updateLessonRequest, getParentProfile } from '@/lib/sheets'
import { materializeFirstOccurrence } from '@/lib/booking-completion'
import { findSchedulingConflict } from '@/lib/availability'
import { formatTime } from '@/lib/schedule'
import { sendEmail, lessonConfirmedEmailHtml } from '@/lib/email'

// Tutor-only: graduates a negotiated request into a real, trackable lesson.
// Deliberately does NOT touch `status` (stays 'in_progress') — see
// isHistoryBooking in lib/lessons.ts for why acceptance is a separate field.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const existing = await getLessonRequestById(id)
  if (!existing || existing.tutorUserId !== session.userId) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  if (existing.status !== 'in_progress') {
    return NextResponse.json({ error: 'Acknowledge this request before accepting it.' }, { status: 400 })
  }
  if (existing.acceptedAt) {
    return NextResponse.json({ error: 'Already accepted.' }, { status: 400 })
  }

  // Another request may have been accepted for an overlapping time since
  // this one came in — re-check before graduating it into a live lesson.
  const conflict = await findSchedulingConflict(existing.tutorUserId, existing)
  if (conflict) {
    return NextResponse.json(
      { error: `That time is no longer free — conflicts with your schedule on ${conflict.date} at ${formatTime(conflict.startTime)}.` },
      { status: 409 },
    )
  }

  const updated = await updateLessonRequest(id, { acceptedAt: new Date().toISOString() })
  if (!updated) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

  await materializeFirstOccurrence(updated)

  try {
    const parent = await getParentProfile(existing.parentUserId)
    if (parent) {
      await sendEmail({
        to: parent.email,
        subject: `Your lesson with ${session.name} is confirmed`,
        html: lessonConfirmedEmailHtml({
          parentName: parent.name,
          tutorName: session.name,
          childName: existing.childName,
          requestedDate: existing.requestedDate,
          requestedStartTime: existing.requestedStartTime,
          requestedEndTime: existing.requestedEndTime,
          dashboardUrl: new URL('/dashboard/parent', request.url).toString(),
        }),
      })
    }
  } catch (err) {
    console.error('[lessons/accept] failed to send email', err)
  }

  return NextResponse.json({ ok: true })
}
