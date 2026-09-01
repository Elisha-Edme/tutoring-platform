'use client'

import { useState, useEffect } from 'react'
import type { TutorAvailabilityRule } from '@/lib/types'
import { formatTime } from '@/lib/schedule'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const START_HOUR = 7   // 7 AM
const END_HOUR = 22    // 10 PM (exclusive)
const SLOT_MIN = 30
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * (60 / SLOT_MIN) // 30

function pad2(n: number) { return String(n).padStart(2, '0') }

function slotToHHMM(slot: number): string {
  const mins = START_HOUR * 60 + slot * SLOT_MIN
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`
}

function hhmmToSlot(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h - START_HOUR) * (60 / SLOT_MIN) + Math.floor(m / SLOT_MIN)
}

function rulesToSelected(rules: TutorAvailabilityRule[]): Set<string> {
  const s = new Set<string>()
  for (const rule of rules) {
    const start = Math.max(0, hhmmToSlot(rule.startTime))
    const end = Math.min(TOTAL_SLOTS, hhmmToSlot(rule.endTime))
    for (const day of rule.repeatDays) {
      const d = DAYS.indexOf(day)
      if (d === -1) continue
      for (let slot = start; slot < end; slot++) s.add(`${d}:${slot}`)
    }
  }
  return s
}

interface Block { dayIndex: number; startSlot: number; endSlot: number }

function selectedToBlocks(selected: Set<string>): Block[] {
  const blocks: Block[] = []
  for (let d = 0; d < 7; d++) {
    const slots: number[] = []
    for (let s = 0; s < TOTAL_SLOTS; s++) {
      if (selected.has(`${d}:${s}`)) slots.push(s)
    }
    if (!slots.length) continue
    let runStart = slots[0], prev = slots[0]
    for (let i = 1; i <= slots.length; i++) {
      if (i === slots.length || slots[i] !== prev + 1) {
        blocks.push({ dayIndex: d, startSlot: runStart, endSlot: prev + 1 })
        if (i < slots.length) runStart = slots[i]
      }
      if (i < slots.length) prev = slots[i]
    }
  }
  return blocks
}

// ── Inline time picker ─────────────────────────────────────────────────────────
// Minutes are a free-form text input so tutors can set any time (e.g. 10:07).
// A local `mDisplay` state tracks what's shown while typing so React doesn't
// re-render the input (and reset the cursor) before the user finishes typing.

function InlineTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hStr, mStr] = value.split(':')
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12

  const [mDisplay, setMDisplay] = useState(mStr)
  // Keep mDisplay in sync when the value changes from outside (e.g. hour/AM-PM change)
  useEffect(() => { setMDisplay(mStr) }, [mStr])

  const commit = (nh12: number, nm: string, nAmpm: string) => {
    let h24 = nh12 % 12
    if (nAmpm === 'PM') h24 += 12
    const m = Math.min(59, Math.max(0, parseInt(nm, 10) || 0))
    onChange(`${pad2(h24)}:${pad2(m)}`)
  }

  const cls = 'border border-gray-200 rounded text-xs py-0.5 bg-white focus:outline-none focus:border-gray-400'
  return (
    <div className="flex items-center gap-0.5">
      {/* Hour — select */}
      <select
        value={h12}
        onChange={e => commit(+e.target.value, mDisplay, ampm)}
        className={`${cls} w-9 text-center`}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      <span className="text-gray-300 text-xs">:</span>

      {/* Minutes — free-form text, normalized on blur */}
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
        className={`${cls} w-11 text-center`}
      />

      {/* AM / PM — select */}
      <select
        value={ampm}
        onChange={e => commit(h12, mDisplay, e.target.value)}
        className={`${cls} w-13 text-center`}
      >
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ScheduleBlock {
  repeatDays: string[]
  startTime: string
  endTime: string
}

interface TimeOverride { startTime: string; endTime: string }

interface Props {
  initialRules: TutorAvailabilityRule[]
  onSave: (blocks: ScheduleBlock[]) => Promise<void>
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function WeeklyAvailabilityGrid({ initialRules, onSave }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => rulesToSelected(initialRules))
  const [drag, setDrag] = useState<{
    day: number; start: number; current: number; mode: 'add' | 'remove'
  } | null>(null)

  // Overrides let tutors set non-grid-snapped times (e.g. 9:45) for a block.
  // Key: `${dayIndex}:${startSlot}` (the block's grid start slot)
  const [overrides, setOverrides] = useState<Map<string, TimeOverride>>(new Map())
  const [editing, setEditing] = useState<string | null>(null)
  const [editStart, setEditStart] = useState('09:00')
  const [editEnd, setEditEnd] = useState('10:00')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const blocks = selectedToBlocks(selected)

  // Cells covered by the active drag
  const dragCells = new Set<string>()
  if (drag) {
    const lo = Math.min(drag.start, drag.current)
    const hi = Math.max(drag.start, drag.current)
    for (let s = lo; s <= hi; s++) dragCells.add(`${drag.day}:${s}`)
  }

  // Commit drag on global mouse-up
  useEffect(() => {
    const onUp = () => {
      if (!drag) return
      const lo = Math.min(drag.start, drag.current)
      const hi = Math.max(drag.start, drag.current)
      setSelected(prev => {
        const next = new Set(prev)
        for (let s = lo; s <= hi; s++) {
          const k = `${drag.day}:${s}`
          if (drag.mode === 'add') next.add(k)
          else next.delete(k)
        }
        return next
      })
      setDrag(null)
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [drag])

  // ── Cell helpers ─────────────────────────────────────────────────────────────

  const cellBg = (d: number, s: number): string => {
    const key = `${d}:${s}`
    const inDrag = dragCells.has(key)
    const isSel = selected.has(key)
    if (inDrag && drag) return drag.mode === 'add' ? 'bg-green-200' : 'bg-rose-200'
    return isSel ? 'bg-green-400 hover:bg-green-500' : 'bg-rose-50 hover:bg-rose-100'
  }

  // ── Block helpers ─────────────────────────────────────────────────────────────

  const blockKey = (b: Block) => `${b.dayIndex}:${b.startSlot}`

  const blockTimes = (b: Block) => {
    const ov = overrides.get(blockKey(b))
    return {
      startTime: ov?.startTime ?? slotToHHMM(b.startSlot),
      endTime: ov?.endTime ?? slotToHHMM(b.endSlot),
    }
  }

  const removeBlock = (b: Block) => {
    const key = blockKey(b)
    setOverrides(prev => { const next = new Map(prev); next.delete(key); return next })
    if (editing === key) setEditing(null)
    setSelected(prev => {
      const next = new Set(prev)
      for (let s = b.startSlot; s < b.endSlot; s++) next.delete(`${b.dayIndex}:${s}`)
      return next
    })
  }

  const startEdit = (b: Block) => {
    const key = blockKey(b)
    const { startTime, endTime } = blockTimes(b)
    setEditStart(startTime)
    setEditEnd(endTime)
    setEditing(key)
  }

  const commitEdit = (key: string) => {
    if (editStart >= editEnd) return
    setOverrides(prev => new Map(prev).set(key, { startTime: editStart, endTime: editEnd }))
    setEditing(null)
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await onSave(
        blocks.map(b => ({
          repeatDays: [DAYS[b.dayIndex]],
          ...blockTimes(b),
        })),
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Failed to save. Please try again.')
    }
    setSaving(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6">
      {/* Grid */}
      <div className="flex-1 select-none overflow-x-auto">
        <div className="inline-flex min-w-full">
          {/* Time labels */}
          <div className="w-16 shrink-0">
            <div className="h-7" />
            {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
              <div key={i} className="h-5 relative">
                {i % 2 === 0 && (
                  <span className="absolute right-2 -top-2 text-[10px] leading-none text-gray-400 whitespace-nowrap">
                    {formatTime(slotToHHMM(i))}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAYS.map((day, d) => (
            <div
              key={day}
              className="flex-1 min-w-[38px] border-l border-gray-200 last:border-r border-gray-200"
            >
              <div className="h-7 flex items-center justify-center border-b border-gray-200">
                <span className="text-[11px] font-semibold text-gray-500">{day}</span>
              </div>
              {Array.from({ length: TOTAL_SLOTS }, (_, s) => (
                <div
                  key={s}
                  className={`h-5 cursor-pointer transition-colors ${cellBg(d, s)} ${
                    s % 2 === 0 ? 'border-t border-gray-300' : 'border-t border-gray-100'
                  }`}
                  onMouseDown={e => {
                    e.preventDefault()
                    const mode = selected.has(`${d}:${s}`) ? 'remove' : 'add'
                    setDrag({ day: d, start: s, current: s, mode })
                  }}
                  onMouseEnter={() => {
                    if (!drag || drag.day !== d) return
                    setDrag(prev => prev ? { ...prev, current: s } : null)
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-52 shrink-0 flex flex-col gap-5 pt-7">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Selected times
          </p>
          {blocks.length === 0 ? (
            <p className="text-xs text-gray-400 leading-relaxed">
              Click or drag on the grid to mark when you're free.
            </p>
          ) : (
            <div className="space-y-3">
              {DAYS.map((_, d) => {
                const dayBlocks = blocks.filter(b => b.dayIndex === d)
                if (!dayBlocks.length) return null
                return (
                  <div key={d}>
                    <p className="text-xs font-semibold text-gray-700 mb-1">{DAY_FULL[d]}</p>
                    {dayBlocks.map(b => {
                      const key = blockKey(b)
                      const { startTime, endTime } = blockTimes(b)
                      const isEditing = editing === key
                      const editInvalid = editStart >= editEnd

                      return (
                        <div key={key} className="mb-1.5">
                          {isEditing ? (
                            <div className="bg-gray-50 rounded-lg p-2 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-400 w-8 shrink-0">From</span>
                                <InlineTimePicker value={editStart} onChange={setEditStart} />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-400 w-8 shrink-0">To</span>
                                <InlineTimePicker value={editEnd} onChange={setEditEnd} />
                              </div>
                              {editInvalid && (
                                <p className="text-[10px] text-red-500">End must be after start.</p>
                              )}
                              <div className="flex gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => commitEdit(key)}
                                  disabled={editInvalid}
                                  className="text-xs text-white bg-gray-800 px-2 py-0.5 rounded disabled:opacity-40 hover:bg-gray-700 transition"
                                >
                                  Done
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditing(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-1 group">
                              <span className="text-xs text-gray-500">
                                {formatTime(startTime)}–{formatTime(endTime)}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEdit(b)}
                                  className="text-[10px] text-gray-300 hover:text-gray-600 transition"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeBlock(b)}
                                  className="text-gray-300 hover:text-red-400 transition text-base leading-none"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full text-sm py-2 rounded-md transition disabled:opacity-50 ${
            saved ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'
          }`}
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save schedule'}
        </button>
      </div>
    </div>
  )
}
