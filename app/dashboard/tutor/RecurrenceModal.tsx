'use client'

import { useState } from 'react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayAbbrevFromDate(dateStr: string): string {
  return DAY_NAMES[new Date(`${dateStr}T00:00:00`).getDay()]
}

export interface RecurringLessonFormData {
  repeatType: 'daily' | 'weekly' | 'monthly' | 'yearly'
  repeatInterval: number
  repeatDays: string[]
  endsType: 'never' | 'on' | 'after'
  endsDate: string
  endsAfterCount: number
}

interface Props {
  onSave: (data: RecurringLessonFormData) => void
  onClose: () => void
  // Seeds the weekly day-of-week default to match the lesson's own date —
  // still editable, just a sensible starting point.
  anchorDate?: string
  // Pre-fills the picker with an existing rule — used when editing (always
  // overriding) an already-live recurring booking's schedule, as opposed to
  // setting one up fresh.
  initial?: RecurringLessonFormData
}

const UNIT_LABELS: Record<RecurringLessonFormData['repeatType'], string> = {
  daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year',
}

export default function RecurrenceModal({ onSave, onClose, anchorDate, initial }: Props) {
  const [repeatType, setRepeatType] = useState<RecurringLessonFormData['repeatType']>(initial?.repeatType ?? 'weekly')
  const [repeatInterval, setRepeatInterval] = useState(initial?.repeatInterval ?? 1)
  const [repeatDays, setRepeatDays] = useState<string[]>(
    initial?.repeatDays ?? (anchorDate ? [dayAbbrevFromDate(anchorDate)] : []),
  )
  const [endsType, setEndsType] = useState<'never' | 'on' | 'after'>(initial?.endsType ?? 'never')
  const [endsDate, setEndsDate] = useState(initial?.endsDate ?? '')
  const [endsAfterCount, setEndsAfterCount] = useState(initial?.endsAfterCount ?? 10)
  const [error, setError] = useState('')

  const toggleDay = (day: string) => {
    setRepeatDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleSave = () => {
    if (repeatType === 'weekly' && repeatDays.length === 0) { setError('Pick at least one day.'); return }
    if (endsType === 'on' && !endsDate) { setError('Pick an end date.'); return }
    if (endsType === 'after' && endsAfterCount < 1) { setError('Enter at least 1 lesson.'); return }
    setError('')
    onSave({
      repeatType,
      repeatInterval,
      repeatDays: repeatType === 'weekly' ? repeatDays : [],
      endsType,
      endsDate: endsType === 'on' ? endsDate : '',
      endsAfterCount: endsType === 'after' ? endsAfterCount : 0,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Repeat this lesson</h2>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Repeat every</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={12}
              value={repeatInterval}
              onChange={e => setRepeatInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-16 border border-gray-300 rounded-md px-2 py-1.5 text-sm text-center"
            />
            <select
              value={repeatType}
              onChange={e => setRepeatType(e.target.value as RecurringLessonFormData['repeatType'])}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            >
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(t => (
                <option key={t} value={t}>{UNIT_LABELS[t]}{repeatInterval > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {repeatType === 'weekly' && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Repeat on</label>
            <div className="flex gap-1.5">
              {DAY_NAMES.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`w-9 h-9 rounded-full text-xs font-medium border transition ${
                    repeatDays.includes(day) ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  {day[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Ends</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {(['never', 'on', 'after'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setEndsType(t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  endsType === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'
                }`}
              >
                {t === 'never' ? 'Never' : t === 'on' ? 'On date' : 'After N lessons'}
              </button>
            ))}
          </div>
          {endsType === 'on' && (
            <input
              type="date"
              value={endsDate}
              onChange={e => setEndsDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full"
            />
          )}
          {endsType === 'after' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={endsAfterCount}
                onChange={e => setEndsAfterCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 border border-gray-300 rounded-md px-2 py-1.5 text-sm text-center"
              />
              <span className="text-sm text-gray-600">lessons</span>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">Cancel</button>
          <button onClick={handleSave} className="bg-gray-900 text-white text-sm px-5 py-2 rounded-md hover:bg-gray-700 transition">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
