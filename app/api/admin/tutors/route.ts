import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAllTutors, getAllOccurrences, getAllReviews } from '@/lib/sheets'
import { computeTutorStats } from '@/lib/lessons'

// Deliberately a separate route from the public GET /api/tutors (same join)
// rather than reusing it — that route is intentionally unauthenticated, and
// layering an admin-only check onto it would blur which one is public.
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [tutors, occurrences, reviews] = await Promise.all([
    getAllTutors(),
    getAllOccurrences(),
    getAllReviews(),
  ])

  const enriched = tutors.map(t => ({
    ...t,
    ...computeTutorStats(t.userId, occurrences, reviews),
  }))

  return NextResponse.json(enriched)
}
