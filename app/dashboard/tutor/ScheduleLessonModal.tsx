'use client'

import { useState, useEffect, useRef } from 'react'
import RecurrenceModal, { type RecurringLessonFormData } from './RecurrenceModal'

const UNIT_NOUNS: Record<RecurringLessonFormData['repeatType'], string> = {
  daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year',
}

// ── Time picker (same free-text pattern as app/tutors/BookingModal.tsx) ────────

function pad2(n: number) { return String(n).padStart(2, '0') }

function TimePicker({ label, value, onChange }: {
  label: string
  value: string      // HH:MM 24-hour
  onChange: (v: string) => void
}) {
  const [hStr, mStr] = value.split(':')
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  const [mDisplay, setMDisplay] = useState(mStr)
  const lastCommittedRef = useRef(mStr)

  useEffect(() => {
    if (mStr !== lastCommittedRef.current) {
      setMDisplay(mStr)
      lastCommittedRef.current = mStr
    }
  }, [mStr])

  const commit = (nh12: number, nm: string, nAmpm: string) => {
    let h24 = nh12 % 12
    if (nAmpm === 'PM') h24 += 12
    const m = Math.min(59, Math.max(0, parseInt(nm, 10) || 0))
    const padded = pad2(m)
    lastCommittedRef.current = padded
    onChange(`${pad2(h24)}:${padded}`)
  }

  const sel = 'border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-gray-500 text-center'

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-1">
        <select value={h12} onChange={e => commit(+e.target.value, mDisplay, ampm)} className={`${sel} w-14`}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="text-gray-400 font-medium">:</span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={mDisplay}
          onChange={e => {
            const raw = e.target.value.replace(/\D/g, '').slice(0, 2)
            setMDisplay(raw)
            const n = parseInt(raw, 10)
            if (!isNaN(n) && n >= 0 && n <= 59) commit(h12, raw, ampm)
          }}
          onBlur={() => {
            const n = Math.min(59, Math.max(0, parseInt(mDisplay, 10) || 0))
            const padded = pad2(n)
            setMDisplay(padded)
            commit(h12, padded, ampm)
          }}
          className={`${sel} w-14`}
        />
        <select value={ampm} onChange={e => commit(h12, mDisplay, e.target.value)} className={`${sel} w-16`}>
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ApprovedStudent {
  parentUserId: string
  parentName: string
  childName: string
}

interface Props {
  onClose: () => void
  onScheduled: () => void
}

export default function ScheduleLessonModal({ onClose, onScheduled }: Props) {
  const [students, setStudents] = useState<ApprovedStudent[]>([])
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [selected, setSelected] = useState<ApprovedStudent | null>(null)

  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('16:00')
  const [endTime, setEndTime] = useState('17:00')

  const [recurrence, setRecurrence] = useState<RecurringLessonFormData | null>(null)
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/tutor/students')
      .then(r => r.json())
      .then(d => setStudents((d.students ?? []).filter((s: { status: string }) => s.status === 'approved')))
      .catch(() => setError('Failed to load your students.'))
      .finally(() => setStudentsLoading(false))
  }, [])

  const timesValid = startTime < endTime

  const handleSubmit = async () => {
    if (!selected || !date || !timesValid) {
      setError('Please fill in all required fields.')
      return
    }
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/tutor/schedule-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentUserId: selected.parentUserId,
        childName: selected.childName,
        requestedDate: date,
        requestedStartTime: startTime,
        requestedEndTime: endTime,
        ...(recurrence ? {
          repeatType: recurrence.repeatType,
          repeatInterval: recurrence.repeatInterval,
          repeatDays: recurrence.repeatDays,
          endsType: recurrence.endsType,
          endsDate: recurrence.endsDate,
          endsAfterCount: recurrence.endsAfterCount,
        } : {}),
      }),
    })
    if (res.ok) {
      setSuccess(true)
      onScheduled()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to schedule the lesson. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        {success ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-4">✓</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Lesson scheduled!</h2>
            <p className="text-sm text-gray-500 mb-6">
              It&rsquo;s confirmed and on the calendar — no approval needed from {selected?.parentName}.
            </p>
            <button
              onClick={onClose}
              className="bg-gray-900 text-white text-sm px-6 py-2 rounded-md hover:bg-gray-700 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Schedule a lesson</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            {/* Step 1 — pick a student */}
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-2">1. Pick a student</p>
              {studentsLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : students.length === 0 ? (
                <p className="text-sm text-gray-400">
                  You don&rsquo;t have any approved students yet — add one from a completed lesson&rsquo;s card first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {students.map(s => (
                    <button
                      key={`${s.parentUserId}-${s.childName}`}
                      type="button"
                      onClick={() => setSelected(s)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${
                        selected?.parentUserId === s.parentUserId && selected?.childName === s.childName
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'border-gray-300 text-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {s.childName} ({s.parentName})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2 — date + time */}
            {selected && (
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 mb-2">2. When?</p>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
                />
                <div className="flex gap-5 flex-wrap">
                  <TimePicker label="Start time" value={startTime} onChange={setStartTime} />
                  <TimePicker label="End time" value={endTime} onChange={setEndTime} />
                </div>
                {!timesValid && (
                  <p className="text-xs text-red-500 mt-1">End time must be after start time.</p>
                )}
              </div>
            )}

            {/* Step 3 — recurring? */}
            {selected && date && timesValid && (
              <div className="mb-5">
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

            {selected && date && timesValid && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-gray-900 text-white py-3 rounded-md text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
              >
                {submitting ? 'Scheduling…' : 'Schedule lesson'}
              </button>
            )}
          </>
        )}
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
