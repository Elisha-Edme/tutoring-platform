import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLessonRequest, getTutorByUserId } from '@/lib/sheets'
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await createLessonRequest(req)

  return NextResponse.json({ ok: true, requestId: req.id })
}
