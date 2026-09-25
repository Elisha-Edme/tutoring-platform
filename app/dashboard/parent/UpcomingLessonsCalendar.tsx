'use client'

import { useState } from 'react'
import { formatTime } from '@/lib/schedule'
import ParentLessonActions, { formatLessonDate, type UpcomingLesson } from './LessonActions'

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKS = 8

function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  lessons: UpcomingLesson[]
  onPropose: (lessonRequestId: string, occurrenceDate: string, date: string, start: string, end: string) => Promise<void>
  onRespond: (lessonRequestId: string, occurrenceDate: string, action: 'approve' | 'decline') => Promise<void>
  onCancel: (lessonRequestId: string, occurrenceDate: string, note: string) => Promise<void>
  submitting: boolean
}

export default function UpcomingLessonsCalendar({ lessons, onPropose, onRespond, onCancel, submitting }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<UpcomingLesson | null>(null)

  const byDate = new Map<string, UpcomingLesson[]>()
  for (const l of lessons) {
    const arr = byDate.get(l.date) ?? []
    arr.push(l)
    byDate.set(l.date, arr)
  }

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

  const chip = (l: UpcomingLesson, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setDetail(l)}
      title={`${l.childName} with ${l.tutorName}, ${formatTime(l.startTime)}–${formatTime(l.endTime)} — click for details`}
      className="w-full text-left text-[10px] bg-blue-50 text-blue-700 rounded px-1 py-0.5 truncate hover:bg-blue-100 transition"
    >
      {formatTime(l.startTime)} · {l.childName}
    </button>
  )

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
          const dayLessons = byDate.get(dateStr) ?? []
          const isPast = day < today
          const isToday = dateStr === toDateString(today)
          const visible = dayLessons.slice(0, 3)
          const overflow = dayLessons.length - visible.length

          return (
            <div
              key={dateStr}
              className={`border-t border-l border-gray-100 min-h-[92px] p-1.5 ${isPast ? 'bg-gray-50/50' : ''}`}
            >
              <p className={`text-xs mb-1 ${isToday ? 'font-bold text-gray-900' : isPast ? 'text-gray-300' : 'text-gray-400'}`}>
                {day.getDate()}
              </p>
              <div className="space-y-0.5">
                {visible.map((l, i) => chip(l, `${l.lessonRequestId}-${i}`))}
                {overflow > 0 && (
                  expanded === dateStr ? (
                    dayLessons.slice(3).map((l, i) => chip(l, `${l.lessonRequestId}-extra-${i}`))
                  ) : (
                    <button
                      onClick={() => setExpanded(dateStr)}
                      className="text-[10px] text-gray-400 hover:text-gray-600 px-1"
                    >
                      +{overflow} more
                    </button>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-900">{detail.childName} with {detail.tutorName}</p>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {formatLessonDate(detail.date)} · {formatTime(detail.startTime)}–{formatTime(detail.endTime)} EST
            </p>
            <ParentLessonActions
              lesson={detail}
              onPropose={onPropose}
              onRespond={onRespond}
              onCancel={onCancel}
              submitting={submitting}
            />
          </div>
        </div>
      )}
    </div>
  )
}
