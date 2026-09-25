'use client'

import { useState } from 'react'
import RecurrenceModal, { type RecurringLessonFormData } from './RecurrenceModal'

export interface RecurringSchedule {
  lessonRequestId: string
  repeatType: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  repeatInterval: number
  repeatDays: string[]
  endsType: 'never' | 'on' | 'after'
  endsDate: string
  endsAfterCount: number
  recurrenceLabel: string
}

export interface StudentDetail {
  childName: string
  grade: string
  instruments: string[]
  recurringSchedule: RecurringSchedule | null
}

interface Props {
  student: StudentDetail
  onClose: () => void
  onUpdated: () => void
}

export default function StudentDetailModal({ student, onClose, onUpdated }: Props) {
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState('')

  const handleSaveSchedule = async (data: RecurringLessonFormData) => {
    if (!student.recurringSchedule) return
    setError('')
    const res = await fetch(`/api/lessons/${student.recurringSchedule.lessonRequestId}/recurrence`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      setEditingSchedule(false)
      onUpdated()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to update the schedule.')
    }
  }

  const handleCancelSeries = async () => {
    if (!student.recurringSchedule) return
    setCancelling(true)
    setError('')
    const res = await fetch(`/api/lessons/${student.recurringSchedule.lessonRequestId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (res.ok) {
      onUpdated()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to cancel the series.')
      setCancelling(false)
    }
  }

  // RecurrenceModal's picker doesn't have a 'biweekly' option (it's a legacy
  // alias, see lib/schedule.ts) — normalize it to weekly+interval:2 so the
  // picker still shows something sensible/editable.
  const initial: RecurringLessonFormData | undefined = student.recurringSchedule ? {
    repeatType: student.recurringSchedule.repeatType === 'biweekly' ? 'weekly' : student.recurringSchedule.repeatType,
    repeatInterval: student.recurringSchedule.repeatType === 'biweekly' ? 2 : student.recurringSchedule.repeatInterval,
    repeatDays: student.recurringSchedule.repeatDays,
    endsType: student.recurringSchedule.endsType,
    endsDate: student.recurringSchedule.endsDate,
    endsAfterCount: student.recurringSchedule.endsAfterCount,
  } : undefined

  return (
    // No click-outside-to-close here (unlike TutorDetailCard/the calendar
    // popups) — this modal can open RecurrenceModal on top of itself, which
    // has no stopPropagation of its own, so any click inside it (a day
    // toggle, Save, anything) would bubble up and close this modal instead
    // of registering. Matches ScheduleLessonModal/AddStudentModal, the two
    // other modals that also open RecurrenceModal: explicit × button only.
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{student.childName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Grade</p>
          <p className="text-sm text-gray-700">{student.grade || 'Not set'}</p>
        </div>
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Instruments</p>
          <p className="text-sm text-gray-700">{student.instruments.join(', ') || 'Not set'}</p>
        </div>
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Recurring schedule</p>
          {student.recurringSchedule ? (
            <>
              <p className="text-sm text-gray-700">{student.recurringSchedule.recurrenceLabel}</p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => setEditingSchedule(true)}
                  className="text-sm text-gray-600 underline hover:text-gray-900"
                >
                  Edit schedule
                </button>
                {!confirmingCancel && (
                  <button
                    onClick={() => setConfirmingCancel(true)}
                    className="text-sm text-gray-600 underline hover:text-gray-900"
                  >
                    Cancel series
                  </button>
                )}
              </div>
              {confirmingCancel && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-sm text-gray-500">Cancel all future lessons in this series?</p>
                  <button
                    onClick={handleCancelSeries}
                    disabled={cancelling}
                    className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-md hover:border-gray-500 transition disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling…' : 'Yes, cancel series'}
                  </button>
                  <button
                    onClick={() => setConfirmingCancel(false)}
                    disabled={cancelling}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Never mind
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">No recurring schedule.</p>
          )}
        </div>
      </div>

      {editingSchedule && (
        <RecurrenceModal
          initial={initial}
          onSave={handleSaveSchedule}
          onClose={() => setEditingSchedule(false)}
        />
      )}
    </div>
  )
}
