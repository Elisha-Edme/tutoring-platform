import { NextResponse } from 'next/server'
import { getAllTutors, getAllOccurrences, getAllReviews } from '@/lib/sheets'
import { computeTutorStats } from '@/lib/lessons'

export async function GET() {
  try {
    const [tutors, occurrences, reviews] = await Promise.all([
      getAllTutors(),
      getAllOccurrences(),
      getAllReviews(),
    ])

    // lessonsCompleted/hoursCompleted/rating are computed fresh here rather than
    // trusted from the stored TutorProfiles columns (see lib/lessons.ts) — those
    // columns are only ever seeded to 0 and never incrementally maintained.
    const enriched = tutors.map(t => ({
      ...t,
      ...computeTutorStats(t.userId, occurrences, reviews),
    }))

    return NextResponse.json(enriched)
  } catch (err) {
    console.error('[tutors]', err)
    return NextResponse.json({ error: 'Failed to fetch tutors.' }, { status: 500 })
  }
}
