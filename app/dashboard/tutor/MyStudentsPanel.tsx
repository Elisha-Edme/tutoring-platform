'use client'

import { useState, useEffect } from 'react'
import StudentDetailModal, { type RecurringSchedule } from './StudentDetailModal'

interface EnrichedStudent {
  tutorUserId: string
  parentUserId: string
  parentName: string
  childName: string
  addedAt: string
  status: 'pending' | 'approved' | 'rejected'
  proposedLessonDate: string
  proposedLessonStartTime: string
  proposedLessonEndTime: string
  instruments: string[]
  grade: string
  recurringSchedule: RecurringSchedule | null
}

const STATUS_LABELS: Record<EnrichedStudent['status'], string> = {
  pending: 'Awaiting parent approval',
  approved: '',
  rejected: 'Declined',
}

const STATUS_COLORS: Record<EnrichedStudent['status'], string> = {
  pending: 'bg-orange-100 text-orange-700',
  approved: '',
  rejected: 'bg-gray-100 text-gray-500',
}

// Click a student to see their instruments and (if they have one) their
// recurring lesson schedule, which a tutor can edit — always an override,
// no parent approval (see StudentDetailModal / PATCH /api/lessons/[id]/recurrence).
export default function MyStudentsPanel() {
  const [students, setStudents] = useState<EnrichedStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState<EnrichedStudent | null>(null)

  const load = () => {
    return fetch('/api/tutor/students')
      .then(r => r.json())
      .then(d => setStudents(d.students ?? []))
      .catch(() => setError('Failed to load students.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleRemove = async (parentUserId: string, childName: string) => {
    const res = await fetch('/api/tutor/students', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentUserId, childName }),
    })
    if (res.ok) setStudents(prev => prev.filter(s => !(s.parentUserId === parentUserId && s.childName === childName)))
    else setError('Failed to remove student.')
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {students.length === 0 ? (
        <p className="text-sm text-gray-400">
          No students yet — complete a one-time lesson with a family, then add them from that lesson&rsquo;s card.
        </p>
      ) : (
        <div className="space-y-2">
          {students.map(s => (
            <div
              key={`${s.parentUserId}-${s.childName}`}
              className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-4 py-3 cursor-pointer hover:border-gray-300 transition"
              onClick={() => setViewing(s)}
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{s.childName}</p>
                <p className="text-xs text-gray-500">Parent: {s.parentName}</p>
                {s.status === 'pending' && s.proposedLessonDate && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Proposed next lesson: {s.proposedLessonDate} · {s.proposedLessonStartTime}–{s.proposedLessonEndTime}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {STATUS_LABELS[s.status] && (
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[s.status]}`}>
                    {STATUS_LABELS[s.status]}
                  </span>
                )}
                {s.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleRemove(s.parentUserId, s.childName) }}
                    className="text-gray-400 hover:text-red-500 transition text-lg leading-none"
                    aria-label={s.status === 'pending' ? 'Withdraw request' : 'Remove student'}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <StudentDetailModal
          student={viewing}
          onClose={() => setViewing(null)}
          onUpdated={() => { setViewing(null); load() }}
        />
      )}
    </div>
  )
}
