'use client'

import { useState, useEffect } from 'react'
import StarRating from '@/components/StarRating'
import ReviewCard from '@/components/ReviewCard'

interface Review {
  id: string
  parentName: string
  rating: number
  comment: string
  createdAt: string
}

export default function ReviewsPanel() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [averageRating, setAverageRating] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tutor/reviews')
      .then(r => r.ok ? r.json() : { reviews: [], averageRating: 0 })
      .then(d => {
        setReviews(d.reviews ?? [])
        setAverageRating(d.averageRating ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  if (reviews.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-400 text-sm">
          No reviews yet — they&apos;ll show up here after you complete a lesson.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        <StarRating rating={averageRating} /> · {reviews.length} review{reviews.length === 1 ? '' : 's'}
      </p>
      <div className="space-y-3">
        {reviews.map(r => (
          <ReviewCard key={r.id} rating={r.rating} comment={r.comment} date={r.createdAt} identityLabel={r.parentName} />
        ))}
      </div>
    </div>
  )
}
