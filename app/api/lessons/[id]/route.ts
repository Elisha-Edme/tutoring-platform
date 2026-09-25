import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestById, getParentProfile, updateLessonRequest, getOccurrencesByLessonRequest, updateLessonOccurrence } from '@/lib/sheets'
import { isTerminalOccurrence } from '@/lib/lessons'
import { sendEmail, lessonTimeChangedEmailHtml } from '@/lib/email'

// Tutor-only: correct a one-time request's date/time, e.g. to match what was
// actually agreed with the parent over email. Allowed on both 'pending' (a
// still-unapproved proposal — editing it before the parent decides is just
// refining the proposal) and 'in_progress' (an already-agreed lesson whose
// time later changed) — never on a terminal request.
export async function PATCH(
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
  if (existing.repeatType !== 'once') {
    return NextResponse.json({ error: 'Only one-time lessons can have their time edited.' }, { status: 400 })
  }
  if (existing.status === 'complete' || existing.status === 'cancelled') {
    return NextResponse.json({ error: 'This lesson can no longer be edited.' }, { status: 400 })
  }

  const body = await request.json()
  const { requestedDate, requestedStartTime, requestedEndTime } = body

  if (!requestedDate || !requestedStartTime || !requestedEndTime) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }
  if (requestedStartTime >= requestedEndTime) {
    return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 })
  }

  const updated = await updateLessonRequest(id, { requestedDate, requestedStartTime, requestedEndTime })
  if (!updated) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

  // Once accepted, an occurrence row for this lesson usually already exists
  // (materialized at Accept time) — keep it tracking the corrected date
  // instead of letting it orphan at the old one.
  if (existing.acceptedAt) {
    const occurrences = await getOccurrencesByLessonRequest(id)
    const occ = occurrences.find(o => o.occurrenceDate === existing.requestedDate && !isTerminalOccurrence(o.status))
    if (occ) {
      await updateLessonOccurrence(occ.id, { occurrenceDate: requestedDate, occurrenceStartTime: requestedStartTime, occurrenceEndTime: requestedEndTime })
    }
  }

  try {
    const parent = await getParentProfile(existing.parentUserId)
    if (parent) {
      await sendEmail({
        to: parent.email,
        subject: `Your lesson time changed`,
        html: lessonTimeChangedEmailHtml({
          parentName: parent.name,
          tutorName: session.name,
          childName: existing.childName,
          oldDate: existing.requestedDate,
          oldStartTime: existing.requestedStartTime,
          oldEndTime: existing.requestedEndTime,
          newDate: requestedDate,
          newStartTime: requestedStartTime,
          newEndTime: requestedEndTime,
          dashboardUrl: new URL('/dashboard/parent', request.url).toString(),
        }),
      })
    }
  } catch (err) {
    console.error('[lessons/[id]] failed to send email', err)
  }

  return NextResponse.json({ ok: true })
}
