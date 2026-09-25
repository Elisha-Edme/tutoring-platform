import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getTutorStudentsByTutor,
  createTutorStudent,
  deleteTutorStudent,
  getParentProfile,
  getLessonRequestsByTutor,
  createLessonRequest,
} from '@/lib/sheets'
import { materializeFirstOccurrence } from '@/lib/booking-completion'
import { findSchedulingConflict } from '@/lib/availability'
import { sendEmail, addStudentRequestEmailHtml } from '@/lib/email'
import { describeLessonRecurrence, formatTime } from '@/lib/schedule'
import type { TutorStudent, LessonRequest } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [students, requests] = await Promise.all([
    getTutorStudentsByTutor(session.userId),
    getLessonRequestsByTutor(session.userId),
  ])

  // Enrich with parent names + each child's instruments/grade.
  const parentIds = [...new Set(students.map(s => s.parentUserId))]
  const parentMap: Record<string, { name: string; children: { name: string; grade: string; instruments: string[] }[] }> = {}
  await Promise.all(
    parentIds.map(async id => {
      const p = await getParentProfile(id)
      if (p) parentMap[id] = { name: p.name, children: p.children }
    }),
  )

  const enriched = students.map(s => {
    const child = parentMap[s.parentUserId]?.children.find(c => c.name === s.childName)
    // The student's live recurring schedule, if any — a LessonRequest with
    // real recurrence that's actually accepted/live, most-recently-accepted
    // one if somehow more than one exists.
    const recurring = requests
      .filter(r => r.parentUserId === s.parentUserId && r.childName === s.childName
        && r.status === 'in_progress' && r.acceptedAt && r.repeatType !== 'once')
      .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))[0]

    return {
      ...s,
      parentName: parentMap[s.parentUserId]?.name ?? '(unknown)',
      instruments: child?.instruments ?? [],
      grade: child?.grade ?? '',
      recurringSchedule: recurring ? {
        lessonRequestId: recurring.id,
        repeatType: recurring.repeatType,
        repeatInterval: recurring.repeatInterval,
        repeatDays: recurring.repeatDays,
        endsType: recurring.endsType,
        endsDate: recurring.endsDate,
        endsAfterCount: recurring.endsAfterCount,
        recurrenceLabel: describeLessonRecurrence(recurring),
      } : null,
    }
  })

  return NextResponse.json({ students: enriched })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    parentUserId, childName,
    proposedLessonDate = '', proposedLessonStartTime = '', proposedLessonEndTime = '',
    proposedRepeatType = 'once', proposedRepeatInterval = 1, proposedRepeatDays = [],
    proposedEndsType = 'never', proposedEndsDate = '', proposedEndsAfterCount = 0,
  } = body

  if (!parentUserId || !childName) {
    return NextResponse.json({ error: 'Missing parentUserId or childName.' }, { status: 400 })
  }
  if (proposedLessonDate && proposedLessonStartTime >= proposedLessonEndTime) {
    return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 })
  }
  if (proposedLessonDate) {
    const conflict = await findSchedulingConflict(session.userId, {
      requestedDate: proposedLessonDate, requestedStartTime: proposedLessonStartTime, requestedEndTime: proposedLessonEndTime,
      repeatType: proposedRepeatType, repeatInterval: proposedRepeatInterval, repeatDays: proposedRepeatDays,
      endsType: proposedEndsType, endsDate: proposedEndsDate, endsAfterCount: proposedEndsAfterCount,
    })
    if (conflict) {
      return NextResponse.json(
        { error: `That conflicts with your own schedule on ${conflict.date} at ${formatTime(conflict.startTime)}.` },
        { status: 409 },
      )
    }
  }

  // Verify the child actually belongs to that parent.
  const profile = await getParentProfile(parentUserId)
  if (!profile) {
    return NextResponse.json({ error: 'Parent not found.' }, { status: 404 })
  }
  const childExists = profile.children.some(c => c.name === childName)
  if (!childExists) {
    return NextResponse.json({ error: 'Child not found under that parent.' }, { status: 404 })
  }

  // "Add student" is only reachable after a completed, one-time first
  // lesson — that's what makes it an established relationship rather than a
  // cold pitch. This is defense in depth; the UI only ever surfaces this
  // action from that specific completed lesson's card.
  const requests = await getLessonRequestsByTutor(session.userId)
  const hasCompletedFirstLesson = requests.some(
    r => r.parentUserId === parentUserId && r.childName === childName
      && r.repeatType === 'once' && r.status === 'complete',
  )
  if (!hasCompletedFirstLesson) {
    return NextResponse.json(
      { error: 'You can only add a student after completing a one-time lesson with them.' },
      { status: 400 },
    )
  }

  // Block a duplicate pending/approved request, but a prior rejection
  // shouldn't stop the tutor from trying again.
  const existing = await getTutorStudentsByTutor(session.userId)
  if (existing.find(
    s => s.parentUserId === parentUserId && s.childName === childName
      && (s.status === 'pending' || s.status === 'approved'),
  )) {
    return NextResponse.json({ error: 'That student is already in your list.' }, { status: 409 })
  }

  // Adding a student is immediate — no parent approval step. If a lesson was
  // proposed too, it's confirmed right away as well: same "create as
  // accepted + materialize" logic PATCH /api/parent/students/[id] used to
  // run at approval time, just run here at creation time instead since
  // there's no more approval step to trigger it from.
  const ts: TutorStudent = {
    id: `ts_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    tutorUserId: session.userId,
    parentUserId,
    childName,
    addedAt: new Date().toISOString(),
    status: 'approved',
    proposedLessonDate,
    proposedLessonStartTime,
    proposedLessonEndTime,
    proposedRepeatType,
    proposedRepeatInterval,
    proposedRepeatDays,
    proposedEndsType,
    proposedEndsDate,
    proposedEndsAfterCount,
  }
  await createTutorStudent(ts)

  if (proposedLessonDate) {
    const now = new Date().toISOString()
    const booking: LessonRequest = {
      id: `req_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      parentUserId,
      childName,
      tutorUserId: session.userId,
      requestedDate: proposedLessonDate,
      requestedStartTime: proposedLessonStartTime,
      requestedEndTime: proposedLessonEndTime,
      message: '',
      status: 'in_progress',
      initiatedBy: 'tutor',
      createdAt: now,
      updatedAt: now,
      repeatType: proposedRepeatType,
      repeatInterval: proposedRepeatInterval,
      repeatDays: proposedRepeatDays,
      endsType: proposedEndsType,
      endsDate: proposedEndsDate,
      endsAfterCount: proposedEndsAfterCount,
      acceptedAt: now,
      declineReason: '',
    }
    await createLessonRequest(booking)
    await materializeFirstOccurrence(booking)
  }

  try {
    await sendEmail({
      to: profile.email,
      subject: `${session.name} added ${childName} as a student`,
      html: addStudentRequestEmailHtml({
        parentName: profile.name,
        tutorName: session.name,
        childName,
        proposedLessonDate,
        proposedLessonStartTime,
        proposedLessonEndTime,
        recurrenceLabel: proposedLessonDate ? describeLessonRecurrence({
          repeatType: proposedRepeatType, repeatInterval: proposedRepeatInterval, repeatDays: proposedRepeatDays,
          requestedStartTime: proposedLessonStartTime, requestedEndTime: proposedLessonEndTime,
          endsType: proposedEndsType, endsDate: proposedEndsDate, endsAfterCount: proposedEndsAfterCount,
        }) : '',
        dashboardUrl: new URL('/dashboard/parent', request.url).toString(),
      }),
    })
  } catch (err) {
    console.error('[tutor/students] failed to send email', err)
  }

  return NextResponse.json({ ok: true, student: ts })
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { parentUserId, childName } = body

  if (!parentUserId || !childName) {
    return NextResponse.json({ error: 'Missing parentUserId or childName.' }, { status: 400 })
  }

  await deleteTutorStudent(session.userId, parentUserId, childName)
  return NextResponse.json({ ok: true })
}
