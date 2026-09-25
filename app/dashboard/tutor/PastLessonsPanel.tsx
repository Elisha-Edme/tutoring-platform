'use client'

import { useState, useEffect } from 'react'
import type { LessonOccurrence, LessonRequest } from '@/lib/types'
import { formatTime } from '@/lib/schedule'
import { isTerminalOccurrence } from '@/lib/lessons'
import AddStudentModal from './AddStudentModal'

interface EnrichedOccurrence extends LessonOccurrence {
  childName: string
  parentUserId: string
  repeatType: LessonRequest['repeatType']
  canAddStudent: boolean
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

export default function PastLessonsPanel() {
  const [lessons, setLessons] = useState<EnrichedOccurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [addStudentFor, setAddStudentFor] = useState<{ parentUserId: string; childName: string } | null>(null)

  const load = () => {
    return fetch('/api/tutor/requests')
      .then(r => r.ok ? r.json() : { requests: [] })
      .then(d => {
        const requests = d.requests ?? []
        const flattened: EnrichedOccurrence[] = requests.flatMap((r: {
          childName: string
          parentUserId: string
          repeatType: LessonRequest['repeatType']
          canAddStudent: boolean
          occurrences: LessonOccurrence[]
        }) =>
          r.occurrences
            .filter((o: LessonOccurrence) => isTerminalOccurrence(o.status))
            .map((o: LessonOccurrence) => ({
              ...o, childName: r.childName, parentUserId: r.parentUserId,
              repeatType: r.repeatType, canAddStudent: r.canAddStudent,
            })),
        )
        flattened.sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate))
        setLessons(flattened)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

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
              <p className="font-semibold text-gray-900 text-sm">{l.childName}</p>
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
          {l.canAddStudent && (
            <button
              onClick={() => setAddStudentFor({ parentUserId: l.parentUserId, childName: l.childName })}
              className="text-sm text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md hover:border-gray-500 transition mt-3"
            >
              + Add student
            </button>
          )}
        </div>
      ))}

      {addStudentFor && (
        <AddStudentModal
          parentUserId={addStudentFor.parentUserId}
          childName={addStudentFor.childName}
          onClose={() => setAddStudentFor(null)}
          onAdded={() => { setAddStudentFor(null); load() }}
        />
      )}
    </div>
  )
}
