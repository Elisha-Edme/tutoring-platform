'use client'

import { formatTime } from '@/lib/schedule'

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKS = 8

function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  windows: Record<string, { startTime: string; endTime: string }[]>
  selectedDate: string | null
  onSelectDate: (date: string) => void
}

// Same rolling-8-week grid as UpcomingLessonsCalendar, repurposed to show
// availability instead of lesson pills — clicking a day just calls back into
// BookingModal's existing handleDateSelect, no separate time-picking logic.
export default function BookingCalendarView({ windows, selectedDate, onSelectDate }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const gridStart = new Date(today)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  const days: Date[] = []
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-xs font-semibold text-gray-500 text-center py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(day => {
          const dateStr = toDateString(day)
          const dayWindows = windows[dateStr] ?? []
          const hasAvailability = dayWindows.length > 0
          const isPast = day < today
          const isSelected = dateStr === selectedDate

          return (
            <button
              type="button"
              key={dateStr}
              disabled={!hasAvailability}
              onClick={() => onSelectDate(dateStr)}
              className={`border-t border-l border-gray-100 min-h-[68px] p-1.5 text-left transition ${
                isSelected ? 'bg-gray-900' : hasAvailability ? 'bg-green-50/60 hover:bg-green-50' : isPast ? 'bg-gray-50/50' : ''
              } ${hasAvailability ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <p className={`text-xs mb-1 ${isSelected ? 'text-white font-bold' : isPast ? 'text-gray-300' : 'text-gray-500'}`}>
                {day.getDate()}
              </p>
              {hasAvailability && (
                <p className={`text-[10px] truncate ${isSelected ? 'text-gray-200' : 'text-green-700'}`}>
                  ● {formatTime(dayWindows[0].startTime)}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
