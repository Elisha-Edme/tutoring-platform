'use client'

import { useState, useEffect } from 'react'
import { getReviewableTutors } from '@/lib/lessons'
import ReviewModal from './ReviewModal'

interface Review {
  rating: number
  comment: string
  createdAt: string
}

interface EnrichedRequest {
  tutorUserId: string
  tutorName: string
  hasCompletedOccurrence: boolean
  review: Review | null
}

// A dashboard-level "leave a review" prompt, decoupled from the Lesson
// Requests tab's per-card logic — computes reviewable tutors directly from
// the same /api/parent/requests data, so it isn't affected by which tab or
// card order the negotiation tracker happens to be showing.
export default function ReviewPromptPanel() {
  const [requests, setRequests] = useState<EnrichedRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<{ tutorUserId: string; tutorName: string } | null>(null)

  useEffect(() => {
    fetch('/api/parent/requests')
      .then(r => (r.ok ? r.json() : { requests: [] }))
      .then(d => setRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const reviewable = getReviewableTutors(requests)
  if (loading || reviewable.length === 0) return null

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Leave a review</h2>
      <div className="space-y-2">
        {reviewable.map(t => (
          <div key={t.tutorUserId} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-700">
              How was your lesson with <span className="font-semibold text-gray-900">{t.tutorName}</span>?
            </p>
            <button
              onClick={() => setReviewing(t)}
              className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition shrink-0"
            >
              Leave a review
            </button>
          </div>
        ))}
      </div>

      {reviewing && (
        <ReviewModal
          tutorUserId={reviewing.tutorUserId}
          tutorName={reviewing.tutorName}
          onClose={() => setReviewing(null)}
          onSubmitted={(review: Review) => {
            setRequests(prev => prev.map(r => (r.tutorUserId === reviewing.tutorUserId ? { ...r, review } : r)))
            setReviewing(null)
          }}
        />
      )}
    </section>
  )
}
