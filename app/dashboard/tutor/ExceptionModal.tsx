'use client'

import { useState } from 'react'

interface SaveData {
  startDate: string
  endDate: string
  type: 'blocked' | 'modified'
  startTime: string
  endTime: string
}

interface Props {
  onSave: (data: SaveData) => Promise<void>
  onClose: () => void
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [hStr, mStr] = value.split(':')
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  const hours12 = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = ['00', '15', '30', '45']
  const selCls = 'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-gray-500 text-center'

  const emit = (newH12: number, newM: string, newAmpm: string) => {
    let h24 = newH12 % 12
    if (newAmpm === 'PM') h24 += 12
    onChange(`${pad2(h24)}:${newM}`)
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-1">
        <select value={h12} onChange={e => emit(parseInt(e.target.value, 10), mStr, ampm)} className={`${selCls} w-14`}>
          {hours12.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-gray-400 text-sm font-medium">:</span>
        <select value={mStr} onChange={e => emit(h12, e.target.value, ampm)} className={`${selCls} w-16`}>
          {minutes.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={ampm} onChange={e => emit(h12, mStr, e.target.value)} className={`${selCls} w-16`}>
          <option>AM</option><option>PM</option>
        </select>
      </div>
    </div>
  )
}

export default function ExceptionModal({ onSave, onClose }: Props) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [type, setType] = useState<'blocked' | 'modified'>('blocked')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('11:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'border border-gray-300 rounded px-3 py-2 text-sm w-full bg-white'

  const handleSave = async () => {
    if (!startDate) { setError('Select a start date.'); return }
    const end = endDate || startDate
    if (end < startDate) { setError('End date must be on or after start date.'); return }
    if (type === 'modified' && startTime >= endTime) { setError('End time must be after start time.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ startDate, endDate: end, type, startTime, endTime })
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Block time off</h2>

        {/* Date range */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }} className={inputCls} />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            To <span className="text-gray-400 font-normal">(leave blank for a single day)</span>
          </label>
          <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
        </div>

        {/* Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Block type</label>
          <div className="flex gap-3">
            {(['blocked', 'modified'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-4 py-2 rounded-full text-sm border transition ${
                  type === t
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-300 text-gray-600 hover:border-gray-500'
                }`}
              >
                {t === 'blocked' ? 'Fully off' : 'Different hours'}
              </button>
            ))}
          </div>
        </div>

        {type === 'modified' && (
          <div className="mb-4 flex gap-4">
            <TimePicker value={startTime} onChange={setStartTime} label="Available from" />
            <TimePicker value={endTime} onChange={setEndTime} label="Until" />
          </div>
        )}

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
