import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createReview, getOccurrencesByParent, getReviewByTutorAndParent } from '@/lib/sheets'
import type { Review } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { tutorUserId, rating, comment = '' } = body

  if (!tutorUserId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'tutorUserId is required and rating must be an integer 1-5.' }, { status: 400 })
  }

  // Eligibility: the parent must have had at least one completed lesson with
  // this tutor. Checked via LessonOccurrences, not LessonRequest.status —
  // a recurring booking's own status never reaches 'complete'.
  const occurrences = await getOccurrencesByParent(session.userId)
  const hasCompletedLesson = occurrences.some(o => o.tutorUserId === tutorUserId && o.status === 'completed')
  if (!hasCompletedLesson) {
    return NextResponse.json({ error: 'You can only review a tutor after completing a lesson with them.' }, { status: 400 })
  }

  const existing = await getReviewByTutorAndParent(tutorUserId, session.userId)
  if (existing) {
    return NextResponse.json({ error: 'You already reviewed this tutor.' }, { status: 409 })
  }

  const review: Review = {
    id: `rev_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    tutorUserId,
    parentUserId: session.userId,
    rating,
    comment,
    createdAt: new Date().toISOString(),
  }
  await createReview(review)

  return NextResponse.json({ ok: true, review })
}
