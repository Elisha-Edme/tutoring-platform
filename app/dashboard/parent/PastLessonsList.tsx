'use client'

import { useState, useEffect } from 'react'
import type { LessonOccurrence } from '@/lib/types'
import { formatTime } from '@/lib/schedule'
import { isTerminalOccurrence } from '@/lib/lessons'

interface EnrichedOccurrence extends LessonOccurrence {
  tutorName: string
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  no_show: 'No-show',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  no_show: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function PastLessonsList() {
  const [lessons, setLessons] = useState<EnrichedOccurrence[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/parent/requests')
      .then(r => r.ok ? r.json() : { requests: [] })
      .then(d => {
        const requests = d.requests ?? []
        const flattened: EnrichedOccurrence[] = requests.flatMap((r: { tutorName: string; occurrences: LessonOccurrence[] }) =>
          r.occurrences
            .filter((o: LessonOccurrence) => isTerminalOccurrence(o.status))
            .map((o: LessonOccurrence) => ({ ...o, tutorName: r.tutorName })),
        )
        flattened.sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate))
        setLessons(flattened)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  if (lessons.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-400 text-sm">No past lessons yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {lessons.map(l => (
        <div key={l.id} className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{l.tutorName}</p>
              <p className="text-xs text-gray-500">
                {formatDate(l.occurrenceDate)} · {formatTime(l.occurrenceStartTime)}–{formatTime(l.occurrenceEndTime)} EST
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[l.status]}`}>
              {STATUS_LABELS[l.status]}
            </span>
          </div>
          {l.summary && (
            <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3 mt-2">
              &ldquo;{l.summary}&rdquo;
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
