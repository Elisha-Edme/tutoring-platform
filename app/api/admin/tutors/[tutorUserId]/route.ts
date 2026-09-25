import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getTutorByUserId,
  getAvailabilityRulesByTutor,
  getExceptionsByTutor,
  getTutorStudentsByTutor,
  getLessonRequestsByTutor,
  getOccurrencesByTutor,
  getReviewsByTutor,
  getParentProfile,
} from '@/lib/sheets'
import { computeTutorStats } from '@/lib/lessons'
import { describeRule, describeLessonRecurrence } from '@/lib/schedule'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tutorUserId: string }> },
) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tutorUserId } = await params
  const [profile, rules, exceptions, students, requests, occurrences, reviews] = await Promise.all([
    getTutorByUserId(tutorUserId),
    getAvailabilityRulesByTutor(tutorUserId),
    getExceptionsByTutor(tutorUserId),
    getTutorStudentsByTutor(tutorUserId),
    getLessonRequestsByTutor(tutorUserId),
    getOccurrencesByTutor(tutorUserId),
    getReviewsByTutor(tutorUserId),
  ])
  if (!profile) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const requestsById = new Map(requests.map(r => [r.id, r]))

  // Same join as GET /api/tutor/availability — 'booked' rows mirror a
  // LessonRequest but don't carry its childName themselves.
  const enrichedExceptions = exceptions.map(exc => ({
    ...exc,
    childName: exc.type === 'booked' ? requestsById.get(exc.sourceLessonRequestId)?.childName ?? '' : '',
  }))

  // Same join as GET /api/tutor/students — parent name + each child's
  // instruments/grade, plus the student's live recurring schedule if any.
  const parentIds = [...new Set([...students.map(s => s.parentUserId), ...requests.map(r => r.parentUserId)])]
  const parentMap: Record<string, { name: string; children: { name: string; grade: string; instruments: string[] }[] }> = {}
  await Promise.all(
    parentIds.map(async id => {
      const p = await getParentProfile(id)
      if (p) parentMap[id] = { name: p.name, children: p.children }
    }),
  )

  const enrichedStudents = students.map(s => {
    const child = parentMap[s.parentUserId]?.children.find(c => c.name === s.childName)
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
        recurrenceLabel: describeLessonRecurrence(recurring),
      } : null,
    }
  })

  const enrichedRequests = requests.map(r => ({
    ...r,
    parentName: parentMap[r.parentUserId]?.name ?? '(unknown)',
    recurrenceLabel: describeLessonRecurrence(r),
  }))

  const enrichedHistory = occurrences
    .map(o => ({
      ...o,
      childName: requestsById.get(o.lessonRequestId)?.childName ?? '',
      parentName: parentMap[o.parentUserId]?.name ?? '(unknown)',
    }))
    .sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate))

  return NextResponse.json({
    profile,
    stats: computeTutorStats(tutorUserId, occurrences, reviews),
    availability: {
      rules: rules.map(r => ({ ...r, label: describeRule(r) })),
      exceptions: enrichedExceptions,
    },
    students: enrichedStudents,
    lessonRequests: enrichedRequests,
    history: enrichedHistory,
  })
}
