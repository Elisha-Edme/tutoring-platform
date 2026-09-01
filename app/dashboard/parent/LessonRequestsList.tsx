'use client'

import { useState, useEffect } from 'react'
import type { LessonRequest } from '@/lib/types'
import { formatTime } from '@/lib/schedule'
import Link from 'next/link'

interface EnrichedRequest extends LessonRequest {
  tutorName: string
}

const STATUS_LABELS: Record<LessonRequest['status'], string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<LessonRequest['status'], string> = {
  pending: 'bg-orange-100 text-orange-700',
  in_progress: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function LessonRequestsList() {
  const [requests, setRequests] = useState<EnrichedRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/parent/requests')
      .then(r => r.ok ? r.json() : { requests: [] })
      .then(d => setRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  if (requests.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-400 text-sm mb-4">No lesson requests yet.</p>
        <Link
          href="/tutors"
          className="inline-block bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition"
        >
          Find a tutor
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map(req => (
        <div key={req.id} className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{req.childName} with {req.tutorName}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDate(req.requestedDate)} · {formatTime(req.requestedStartTime)}–{formatTime(req.requestedEndTime)} EST
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[req.status]}`}>
              {STATUS_LABELS[req.status]}
            </span>
          </div>
          {req.message && (
            <p className="text-xs text-gray-400 italic mt-2 border-l-2 border-gray-100 pl-2">
              &ldquo;{req.message}&rdquo;
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
