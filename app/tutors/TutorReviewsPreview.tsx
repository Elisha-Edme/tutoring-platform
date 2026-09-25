'use client'

import { useState, useEffect } from 'react'
import ReviewCard from '@/components/ReviewCard'

interface Review {
  rating: number
  comment: string
  createdAt: string
}

export default function TutorReviewsPreview({ tutorUserId }: { tutorUserId: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/tutors/${tutorUserId}/reviews`)
      .then(r => r.ok ? r.json() : { reviews: [] })
      .then(d => setReviews(d.reviews ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tutorUserId])

  if (loading) return <p className="text-xs text-gray-400 py-2">Loading reviews…</p>
  if (reviews.length === 0) return <p className="text-xs text-gray-400 py-2">No reviews yet.</p>

  const shown = reviews.slice(0, 5)

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Reviews ({reviews.length})
      </p>
      <div className="space-y-2">
        {shown.map((r, i) => (
          <ReviewCard key={i} rating={r.rating} comment={r.comment} date={r.createdAt} identityLabel="Verified parent" />
        ))}
      </div>
      {reviews.length > shown.length && (
        <p className="text-xs text-gray-400 mt-2">Showing 5 most recent reviews.</p>
      )}
    </div>
  )
}
