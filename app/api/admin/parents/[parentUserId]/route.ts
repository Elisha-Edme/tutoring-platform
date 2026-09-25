import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getParentProfile,
  getLessonRequestsByParent,
  getOccurrencesByParent,
  getTutorByUserId,
} from '@/lib/sheets'
import { describeLessonRecurrence } from '@/lib/schedule'
import type { TutorProfile } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ parentUserId: string }> },
) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { parentUserId } = await params
  const [profile, requests, occurrences] = await Promise.all([
    getParentProfile(parentUserId),
    getLessonRequestsByParent(parentUserId),
    getOccurrencesByParent(parentUserId),
  ])
  if (!profile) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const requestsById = new Map(requests.map(r => [r.id, r]))
  const tutorIds = [...new Set(requests.map(r => r.tutorUserId))]
  const tutors = await Promise.all(tutorIds.map(getTutorByUserId))
  const tutorMap = new Map(
    tutors.filter((t): t is TutorProfile => t !== null).map(t => [t.userId, t]),
  )

  const enrichedRequests = requests.map(r => ({
    ...r,
    tutorName: tutorMap.get(r.tutorUserId)?.name ?? '(unknown)',
    recurrenceLabel: describeLessonRecurrence(r),
  }))

  const enrichedHistory = occurrences
    .map(o => ({
      ...o,
      tutorName: tutorMap.get(o.tutorUserId)?.name ?? '(unknown)',
      childName: requestsById.get(o.lessonRequestId)?.childName ?? '',
    }))
    .sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate))

  return NextResponse.json({
    profile,
    lessonRequests: enrichedRequests,
    history: enrichedHistory,
    tutorsWorkedWith: [...tutorMap.values()].map(t => ({ userId: t.userId, name: t.name, instruments: t.instruments })),
  })
}
