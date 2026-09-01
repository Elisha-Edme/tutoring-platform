'use client'

import { useState } from 'react'

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DURATIONS = [30, 45, 60, 90, 120]

export interface WeeklyWindowFormData {
  repeatType: 'weekly'
  repeatInterval: 1
  repeatDays: string[]
  startTime: string
  endTime: string
  lessonDurationMinutes: number
  endsType: 'never'
  endsDate: ''
  endsAfterCount: 0
}

interface Props {
  onSave: (data: WeeklyWindowFormData) => Promise<void>
  onClose: () => void
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [hStr, mStr] = value.split(':')
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  const hours12 = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = ['00', '15', '30', '45']
  const inputCls = 'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white'

  const emit = (newH12: number, newM: string, newAmpm: string) => {
    let h24 = newH12 % 12
    if (newAmpm === 'PM') h24 += 12
    onChange(`${pad2(h24)}:${newM}`)
  }

  return (
    <div>
      {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
      <div className="flex items-center gap-1">
        <select value={h12} onChange={e => emit(parseInt(e.target.value, 10), mStr, ampm)} className={inputCls}>
          {hours12.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-gray-400 text-sm">:</span>
        <select value={mStr} onChange={e => emit(h12, e.target.value, ampm)} className={inputCls}>
          {minutes.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={ampm} onChange={e => emit(h12, mStr, e.target.value)} className={inputCls}>
          <option>AM</option><option>PM</option>
        </select>
      </div>
    </div>
  )
}

export default function RecurrenceModal({ onSave, onClose }: Props) {
  const [days, setDays] = useState<string[]>(['Mon'])
  const [startTime, setStartTime] = useState('16:00')
  const [endTime, setEndTime] = useState('18:00')
  const [duration, setDuration] = useState(60)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleDay = (day: string) =>
    setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  const handleSave = async () => {
    if (days.length === 0) { setError('Select at least one day.'); return }
    if (!startTime || !endTime) { setError('Set start and end times.'); return }
    if (startTime >= endTime) { setError('End time must be after start time.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        repeatType: 'weekly',
        repeatInterval: 1,
        repeatDays: days,
        startTime,
        endTime,
        lessonDurationMinutes: duration,
        endsType: 'never',
        endsDate: '',
        endsAfterCount: 0,
      })
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Add availability window</h2>

        {/* Days */}
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Which days?</p>
          <div className="flex gap-1.5 flex-wrap">
            {DAYS_SHORT.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  days.includes(day)
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-300 text-gray-600 hover:border-gray-500'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Times */}
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-3">What hours?</p>
          <div className="flex items-end gap-4 flex-wrap">
            <TimePicker value={startTime} onChange={setStartTime} label="From" />
            <TimePicker value={endTime} onChange={setEndTime} label="To" />
          </div>
        </div>

        {/* Duration */}
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Lesson length</p>
          <div className="flex gap-2 flex-wrap">
            {DURATIONS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  duration === d
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-300 text-gray-600 hover:border-gray-500'
                }`}
              >
                {d < 60 ? `${d} min` : `${d / 60} hr`}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={saving} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gray-900 text-white text-sm px-5 py-2 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
