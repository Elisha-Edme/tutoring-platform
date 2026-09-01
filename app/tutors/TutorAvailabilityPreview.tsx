'use client'

import { useState, useEffect } from 'react'
import { formatTime } from '@/lib/schedule'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const START_HOUR = 7
const END_HOUR = 22
const SLOT_MIN = 30
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * (60 / SLOT_MIN)

function pad2(n: number) { return String(n).padStart(2, '0') }

function slotToHHMM(slot: number) {
  const mins = START_HOUR * 60 + slot * SLOT_MIN
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`
}

function timeToSlot(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return (h - START_HOUR) * (60 / SLOT_MIN) + Math.floor(m / SLOT_MIN)
}

export default function TutorAvailabilityPreview({ tutorUserId }: { tutorUserId: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    const today = new Date()
    const from = today.toISOString().slice(0, 10)
    const toDate = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000)
    const to = toDate.toISOString().slice(0, 10)

    fetch(`/api/tutors/${tutorUserId}/windows?from=${from}&to=${to}`)
      .then(r => r.ok ? r.json() : { windows: {} })
      .then(data => {
        const windows: Record<string, { startTime: string; endTime: string }[]> = data.windows ?? {}
        const sel = new Set<string>()
        for (const [dateStr, wins] of Object.entries(windows)) {
          const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay()
          for (const win of wins) {
            const startSlot = Math.max(0, timeToSlot(win.startTime))
            const endSlot = Math.min(TOTAL_SLOTS, timeToSlot(win.endTime))
            for (let s = startSlot; s < endSlot; s++) sel.add(`${dayOfWeek}:${s}`)
          }
        }
        setSelected(sel)
        setEmpty(sel.size === 0)
      })
      .catch(() => setEmpty(true))
      .finally(() => setLoading(false))
  }, [tutorUserId])

  if (loading) return <p className="text-xs text-gray-400 py-2">Loading availability…</p>
  if (empty) return <p className="text-xs text-gray-400 py-2">No availability set yet.</p>

  return (
    <div className="select-none overflow-x-auto">
      <div className="inline-flex min-w-full">
        {/* Time labels */}
        <div className="w-14 shrink-0">
          <div className="h-6" />
          {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
            <div key={i} className="h-4 relative">
              {i % 2 === 0 && (
                <span className="absolute right-1 -top-1.5 text-[9px] leading-none text-gray-400 whitespace-nowrap">
                  {formatTime(slotToHHMM(i))}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((day, d) => (
          <div key={day} className="flex-1 min-w-[34px] border-l border-gray-200 last:border-r border-gray-200">
            <div className="h-6 flex items-center justify-center border-b border-gray-200">
              <span className="text-[10px] font-semibold text-gray-500">{day}</span>
            </div>
            {Array.from({ length: TOTAL_SLOTS }, (_, s) => (
              <div
                key={s}
                className={`h-4 ${
                  selected.has(`${d}:${s}`) ? 'bg-green-400' : 'bg-rose-50'
                } ${s % 2 === 0 ? 'border-t border-gray-300' : 'border-t border-gray-100'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
