'use client'

import { useState, useEffect } from 'react'

interface EnrichedStudentRequest {
  id: string
  tutorUserId: string
  tutorName: string
  childName: string
  status: 'pending' | 'approved' | 'rejected'
  proposedLessonDate: string
  proposedLessonStartTime: string
  proposedLessonEndTime: string
}

interface Props {
  onDecision?: () => void
}

export default function StudentRequestsPanel({ onDecision }: Props) {
  const [requests, setRequests] = useState<EnrichedStudentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/parent/students')
      .then(r => r.json())
      .then(d => setRequests((d.students ?? []).filter((s: EnrichedStudentRequest) => s.status === 'pending')))
      .catch(() => setError('Failed to load student requests.'))
      .finally(() => setLoading(false))
  }, [])

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setDeciding(id)
    setError('')
    const res = await fetch(`/api/parent/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      setRequests(prev => prev.filter(r => r.id !== id))
      onDecision?.()
    } else {
      setError('Failed to update. Try again.')
    }
    setDeciding(null)
  }

  if (loading) return null
  if (requests.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Student requests
      </h2>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="space-y-3">
        {requests.map(req => (
          <div key={req.id} className="border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-700">
              <strong>{req.tutorName}</strong> would like to add <strong>{req.childName}</strong> as an ongoing student.
            </p>
            {req.proposedLessonDate && (
              <p className="text-xs text-gray-500 mt-1">
                Proposed next lesson: {req.proposedLessonDate} · {req.proposedLessonStartTime}–{req.proposedLessonEndTime}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => decide(req.id, 'approve')}
                disabled={deciding === req.id}
                className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => decide(req.id, 'reject')}
                disabled={deciding === req.id}
                className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-md hover:border-gray-500 transition disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
