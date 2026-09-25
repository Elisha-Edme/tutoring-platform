'use client'

import { useState } from 'react'
import RecurrenceModal, { type RecurringLessonFormData } from './RecurrenceModal'

const UNIT_NOUNS: Record<RecurringLessonFormData['repeatType'], string> = {
  daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year',
}

interface Props {
  parentUserId: string
  childName: string
  onClose: () => void
  onAdded: () => void
}

// Triggered only from a specific completed one-time lesson's card (see
// LessonRequestsPanel's canAddStudent flag) — no lookup fields, since the
// parent/child are already known from that card. Proposing a lesson (and,
// within that, a recurring schedule) is fully optional — a tutor can just
// add the student and be done.
export default function AddStudentModal({ parentUserId, childName, onClose, onAdded }: Props) {
  const [proposeLesson, setProposeLesson] = useState(false)
  const [date, setDate] = useState('')
  const [start, setStart] = useState('16:00')
  const [end, setEnd] = useState('17:00')
  const [recurrence, setRecurrence] = useState<RecurringLessonFormData | null>(null)
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const timesValid = !proposeLesson || (date && start < end)

  const handleSubmit = async () => {
    if (!timesValid) {
      setError('End time must be after start time.')
      return
    }
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/tutor/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentUserId,
        childName,
        ...(proposeLesson ? {
          proposedLessonDate: date, proposedLessonStartTime: start, proposedLessonEndTime: end,
          ...(recurrence ? {
            proposedRepeatType: recurrence.repeatType,
            proposedRepeatInterval: recurrence.repeatInterval,
            proposedRepeatDays: recurrence.repeatDays,
            proposedEndsType: recurrence.endsType,
            proposedEndsDate: recurrence.endsDate,
            proposedEndsAfterCount: recurrence.endsAfterCount,
          } : {}),
        } : {}),
      }),
    })
    if (res.ok) {
      onAdded()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to add the student.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Add {childName} as a student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {childName} will be added as your ongoing student right away.
          {proposeLesson && ' The lesson time below will be confirmed immediately too — no approval needed.'}
        </p>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <input
            type="checkbox"
            checked={proposeLesson}
            onChange={e => setProposeLesson(e.target.checked)}
            className="rounded border-gray-300"
          />
          Propose a next lesson time?
        </label>

        {proposeLesson && (
          <>
            <div className="flex gap-2 items-center flex-wrap mb-4">
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
              <input type="time" value={start} onChange={e => setStart(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
              <span className="text-gray-400">–</span>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
            </div>

            {date && start < end && (
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!recurrence}
                    onChange={e => {
                      if (e.target.checked) setShowRecurrenceModal(true)
                      else setRecurrence(null)
                    }}
                    className="rounded border-gray-300"
                  />
                  Repeat this lesson?
                </label>
                {recurrence && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Every {recurrence.repeatInterval > 1 ? `${recurrence.repeatInterval} ${UNIT_NOUNS[recurrence.repeatType]}s` : UNIT_NOUNS[recurrence.repeatType]}
                    {recurrence.endsType === 'on' && recurrence.endsDate && ` until ${recurrence.endsDate}`}
                    {recurrence.endsType === 'after' && ` for ${recurrence.endsAfterCount} lessons`}
                    {' · '}
                    <button type="button" onClick={() => setShowRecurrenceModal(true)} className="underline hover:text-gray-700">
                      Edit
                    </button>
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-gray-900 text-white py-3 rounded-md text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add student'}
        </button>
      </div>

      {showRecurrenceModal && (
        <RecurrenceModal
          anchorDate={date}
          onSave={data => { setRecurrence(data); setShowRecurrenceModal(false) }}
          onClose={() => setShowRecurrenceModal(false)}
        />
      )}
    </div>
  )
}
