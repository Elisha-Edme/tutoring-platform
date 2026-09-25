import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getReviewsByTutor, getParentProfile } from '@/lib/sheets'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reviews = await getReviewsByTutor(session.userId)
  reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // Enrich with parent names — not public data, so no anonymization needed here.
  const parentIds = [...new Set(reviews.map(r => r.parentUserId))]
  const parentMap: Record<string, string> = {}
  await Promise.all(
    parentIds.map(async id => {
      const p = await getParentProfile(id)
      if (p) parentMap[id] = p.name
    }),
  )

  const enriched = reviews.map(r => ({
    ...r,
    parentName: parentMap[r.parentUserId] ?? '(unknown)',
  }))

  const count = reviews.length
  const averageRating = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0

  return NextResponse.json({ reviews: enriched, averageRating, count })
}
