import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLessonRequest, getTutorByUserId } from '@/lib/sheets'
import { sendEmail, lessonRequestEmailHtml } from '@/lib/email'
import type { LessonRequest } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'You must be signed in as a parent to request a lesson.' }, { status: 401 })
  }

  const body = await request.json()
  const {
    tutorUserId,
    childName,
    requestedDate,
    requestedStartTime,
    requestedEndTime,
    message = '',
    repeatType = 'once',
    repeatInterval = 1,
    repeatDays = [],
    endsType = 'never',
    endsDate = '',
    endsAfterCount = 0,
  } = body

  if (!tutorUserId || !childName || !requestedDate || !requestedStartTime || !requestedEndTime) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const tutor = await getTutorByUserId(tutorUserId)
  if (!tutor) return NextResponse.json({ error: 'Tutor not found.' }, { status: 404 })

  const req: LessonRequest = {
    id: `req_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    parentUserId: session.userId,
    childName,
    tutorUserId,
    requestedDate,
    requestedStartTime,
    requestedEndTime,
    message,
    status: 'pending',
    initiatedBy: 'parent',
    acceptedAt: '',
    declineReason: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    repeatType,
    repeatInterval,
    repeatDays,
    endsType,
    endsDate,
    endsAfterCount,
  }

  await createLessonRequest(req)

  try {
    await sendEmail({
      to: tutor.email,
      replyTo: session.email,
      subject: `New lesson request from ${session.name}`,
      html: lessonRequestEmailHtml({
        tutorName: tutor.name,
        parentName: session.name,
        parentEmail: session.email,
        childName,
        requestedDate,
        requestedStartTime,
        requestedEndTime,
        message,
        dashboardUrl: new URL('/dashboard/tutor', request.url).toString(),
      }),
    })
  } catch (err) {
    console.error('[lessons/request] failed to send email', err)
  }

  return NextResponse.json({ ok: true, requestId: req.id })
}
