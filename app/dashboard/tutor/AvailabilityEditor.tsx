'use client'

import { useState, useEffect } from 'react'
import type { TutorAvailabilityRule, AvailabilityException } from '@/lib/types'
import { formatTime, describeLessonRecurrence } from '@/lib/schedule'
import type { LessonRequest } from '@/lib/types'
import WeeklyAvailabilityGrid, { type ScheduleBlock } from './WeeklyAvailabilityGrid'
import ExceptionModal from './ExceptionModal'

// 'booked' rows come back from GET /api/tutor/availability with a childName
// the sheet row itself doesn't store (looked up server-side) — see that
// route for why.
type EnrichedException = AvailabilityException & { childName?: string }

export default function AvailabilityEditor() {
  const [rules, setRules] = useState<TutorAvailabilityRule[]>([])
  const [exceptions, setExceptions] = useState<EnrichedException[]>([])
  const [loading, setLoading] = useState(true)
  const [showException, setShowException] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/tutor/availability')
      .then(r => r.json())
      .then(d => {
        setRules(d.rules ?? [])
        setExceptions(d.exceptions ?? [])
      })
      .catch(() => setError('Failed to load availability.'))
      .finally(() => setLoading(false))
  }, [])

  // Replace all existing rules with the new set from the grid.
  const handleSaveSchedule = async (blocks: ScheduleBlock[]) => {
    await Promise.all(
      rules.map(r => fetch(`/api/tutor/availability?id=${r.id}`, { method: 'DELETE' }))
    )
    const created: TutorAvailabilityRule[] = []
    for (const block of blocks) {
      const res = await fetch('/api/tutor/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block),
      })
      if (!res.ok) throw new Error('Failed to save rule.')
      const d = await res.json()
      created.push(d.rule)
    }
    setRules(created)
  }

  const handleAddException = async (
    data: Parameters<typeof ExceptionModal>[0]['onSave'] extends (d: infer D) => unknown ? D : never,
  ) => {
    const res = await fetch('/api/tutor/availability/exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error ?? 'Save failed')
    }
    const d = await res.json()
    setExceptions(prev => [...prev, d.exception])
    setShowException(false)
  }

  const handleDeleteException = async (id: string) => {
    const res = await fetch(`/api/tutor/availability/exceptions?id=${id}`, { method: 'DELETE' })
    if (res.ok) setExceptions(prev => prev.filter(e => e.id !== id))
    else setError('Failed to delete exception.')
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="space-y-10">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* ── Your weekly schedule ─────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Your weekly schedule</h3>
        <p className="text-xs text-gray-400 mb-4">
          Click or drag to mark the hours you&rsquo;re available each week.
        </p>
        <WeeklyAvailabilityGrid
          initialRules={rules}
          bookedExceptions={exceptions.filter(e => e.type === 'booked')}
          onSave={handleSaveSchedule}
        />
      </div>

      {/* ── Exceptions ───────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Exceptions</h3>
        <p className="text-xs text-gray-400 mb-3">
          Block specific dates or date ranges that differ from your normal schedule.
        </p>

        {exceptions.length > 0 && (
          <div className="space-y-1 mb-3">
            {exceptions.map(exc => (
              <div
                key={exc.id}
                className="flex items-center justify-between gap-3 text-sm text-gray-600"
              >
                {exc.type === 'booked' ? (
                  <span>
                    Booked: {exc.childName || 'a student'} — {describeLessonRecurrence({
                      repeatType: exc.repeatType as LessonRequest['repeatType'],
                      repeatInterval: exc.repeatInterval,
                      repeatDays: exc.repeatDays,
                      requestedStartTime: exc.startTime,
                      requestedEndTime: exc.endTime,
                      endsType: exc.endsType as LessonRequest['endsType'],
                      endsDate: exc.endsDate,
                      endsAfterCount: exc.endsAfterCount,
                    })}
                  </span>
                ) : (
                  <span>
                    {exc.startDate === exc.endDate
                      ? exc.startDate
                      : `${exc.startDate} → ${exc.endDate}`}
                    {' — '}
                    {exc.type === 'blocked'
                      ? 'Off'
                      : `${formatTime(exc.startTime)}–${formatTime(exc.endTime)}`}
                  </span>
                )}
                {exc.type === 'booked' ? (
                  // Not deletable from here — only by cancelling the actual
                  // lesson series (My Students -> Cancel series).
                  <span className="text-xs text-gray-400 shrink-0">via lesson</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDeleteException(exc.id)}
                    aria-label="Delete exception"
                    className="text-gray-400 hover:text-red-500 transition"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowException(true)}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          + Block a date or date range
        </button>
      </div>

      {showException && (
        <ExceptionModal onSave={handleAddException} onClose={() => setShowException(false)} />
      )}
    </div>
  )
}
