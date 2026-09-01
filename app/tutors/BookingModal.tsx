'use client'

import { useState, useEffect } from 'react'
import type { Child } from '@/lib/types'
import { formatTime } from '@/lib/schedule'

// ── Time picker ────────────────────────────────────────────────────────────────

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

  useEffect(() => { setMDisplay(mStr) }, [mStr])

  const commit = (nh12: number, nm: string, nAmpm: string) => {
    let h24 = nh12 % 12
    if (nAmpm === 'PM') h24 += 12
    const m = Math.min(59, Math.max(0, parseInt(nm, 10) || 0))
    onChange(`${pad2(h24)}:${pad2(m)}`)
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateChip(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function formatDateHeading(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  tutorUserId: string
  tutorName: string
  onClose: () => void
}

export default function BookingModal({ tutorUserId, tutorName, onClose }: Props) {
  // Windows: Record<date, {startTime, endTime}[]>
  const [windows, setWindows] = useState<Record<string, { startTime: string; endTime: string }[]>>({})
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [selectedChild, setSelectedChild] = useState('')
  const [message, setMessage] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const today = new Date()
    const from = today.toISOString().slice(0, 10)
    const toDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
    const to = toDate.toISOString().slice(0, 10)

    Promise.all([
      fetch(`/api/tutors/${tutorUserId}/windows?from=${from}&to=${to}`).then(r => r.json()),
      fetch('/api/parent/children').then(r => r.ok ? r.json() : { children: [] }),
    ])
      .then(([winData, childData]) => {
        setWindows(winData.windows ?? {})
        const kids = childData.children ?? []
        setChildren(kids)
        if (kids.length === 1) setSelectedChild(kids[0].name)
      })
      .catch(() => setError('Failed to load tutor availability.'))
      .finally(() => setLoading(false))
  }, [tutorUserId])

  const availableDates = Object.keys(windows).sort()

  // When a date is picked, seed the time pickers from the first window.
  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
    const wins = windows[date]
    if (wins?.length) {
      setStartTime(wins[0].startTime)
      setEndTime(wins[0].endTime)
    }
  }

  const timesValid = startTime < endTime

  const handleSubmit = async () => {
    if (!selectedDate || !timesValid || !selectedChild) {
      setError('Please fill in all required fields.')
      return
    }
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/lessons/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tutorUserId,
        childName: selectedChild,
        requestedDate: selectedDate,
        requestedStartTime: startTime,
        requestedEndTime: endTime,
        message,
      }),
    })
    if (res.ok) {
      setSuccess(true)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to submit request. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">

        {success ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-4">✓</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Request sent!</h2>
            <p className="text-sm text-gray-500 mb-6">
              We've sent your request to {tutorName}. They'll be in touch soon.
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
              <h2 className="text-lg font-semibold text-gray-900">
                Request a lesson with {tutorName}
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            {loading ? (
              <p className="text-sm text-gray-400 py-4">Loading availability…</p>
            ) : availableDates.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                {tutorName} hasn't set their availability yet. Check back later.
              </p>
            ) : (
              <>
                {/* Step 1 — date */}
                <div className="mb-5">
                  <p className="text-sm font-medium text-gray-700 mb-2">1. Pick a date</p>
                  <div className="flex flex-wrap gap-2">
                    {availableDates.map(date => (
                      <button
                        key={date}
                        type="button"
                        onClick={() => handleDateSelect(date)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                          selectedDate === date
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'border-gray-200 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {formatDateChip(date)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2 — time */}
                {selectedDate && (
                  <div className="mb-5">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      2. Choose a time — {formatDateHeading(selectedDate)}
                    </p>

                    {/* Show tutor's available windows for reference */}
                    <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
                      <p className="text-xs text-gray-500 mb-0.5">Tutor available:</p>
                      {(windows[selectedDate] ?? []).map((w, i) => (
                        <span key={i} className="text-xs text-gray-700 font-medium">
                          {i > 0 && <span className="text-gray-400 mx-1">·</span>}
                          {formatTime(w.startTime)}–{formatTime(w.endTime)}
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-5 flex-wrap">
                      <TimePicker label="Start time" value={startTime} onChange={setStartTime} />
                      <TimePicker label="End time" value={endTime} onChange={setEndTime} />
                    </div>
                    {!timesValid && startTime && endTime && (
                      <p className="text-xs text-red-500 mt-1">End time must be after start time.</p>
                    )}
                  </div>
                )}

                {/* Step 3 — child */}
                {selectedDate && timesValid && (
                  <div className="mb-5">
                    <p className="text-sm font-medium text-gray-700 mb-2">3. Which child?</p>
                    {children.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        No children on your account yet.{' '}
                        <a href="/dashboard/parent" className="underline">Add one on your dashboard.</a>
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {children.map(c => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => setSelectedChild(c.name)}
                            className={`px-3 py-1.5 rounded-full text-sm border transition ${
                              selectedChild === c.name
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'border-gray-300 text-gray-600 hover:border-gray-500'
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4 — message */}
                {selectedDate && timesValid && selectedChild && (
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      4. Message <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={3}
                      placeholder={`Hi ${tutorName}, I'd love to schedule a lesson…`}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                )}

                {selectedDate && timesValid && selectedChild && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full bg-gray-900 text-white py-3 rounded-md text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Request lesson'}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
