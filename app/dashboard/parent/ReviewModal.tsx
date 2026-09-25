'use client'

import { useState } from 'react'
import StarRatingInput from '@/components/StarRatingInput'

interface Props {
  tutorUserId: string
  tutorName: string
  onClose: () => void
  onSubmitted: (review: { rating: number; comment: string; createdAt: string }) => void
}

export default function ReviewModal({ tutorUserId, tutorName, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState<{ rating: number; comment: string; createdAt: string } | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (rating < 1) {
      setError('Please select a rating.')
      return
    }
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutorUserId, rating, comment }),
    })
    if (res.ok) {
      const d = await res.json()
      setSaved(d.review)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to submit review. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {saved ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-4">✓</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Thanks for your feedback!</h2>
            <button
              onClick={() => onSubmitted(saved)}
              className="bg-gray-900 text-white text-sm px-6 py-2 rounded-md hover:bg-gray-700 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Rate {tutorName}
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            <div className="mb-5">
              <StarRatingInput value={rating} onChange={setRating} />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder={`How did the lesson with ${tutorName} go?`}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-gray-900 text-white py-3 rounded-md text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
