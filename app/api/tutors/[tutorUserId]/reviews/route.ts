import { NextRequest, NextResponse } from 'next/server'
import { getReviewsByTutor } from '@/lib/sheets'

// Public — no auth required. Identity fields are intentionally omitted: these
// are reviews of lessons given to minors, so the directory only ever shows
// rating + comment + date, never parent/child names.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tutorUserId: string }> },
) {
  const { tutorUserId } = await params
  const reviews = await getReviewsByTutor(tutorUserId)
  reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const anonymized = reviews.map(r => ({
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  }))

  return NextResponse.json({ reviews: anonymized })
}
