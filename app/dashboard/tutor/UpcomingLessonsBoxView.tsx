'use client'

import { formatTime } from '@/lib/schedule'
import TutorLessonActions, { formatLessonDate, type UpcomingLesson } from './LessonActions'

export type { UpcomingLesson }

interface Props {
  lessons: UpcomingLesson[]
  onPropose: (lessonRequestId: string, occurrenceDate: string, date: string, start: string, end: string, override: boolean) => Promise<void>
  onRespond: (lessonRequestId: string, occurrenceDate: string, action: 'approve' | 'decline') => Promise<void>
  onComplete: (lessonRequestId: string, occurrenceDate: string, summary: string) => Promise<void>
  onOccurrenceStatus: (lessonRequestId: string, occurrenceDate: string, status: 'no_show' | 'cancelled', note: string) => Promise<void>
  submitting: boolean
}

export default function UpcomingLessonsBoxView({ lessons, onPropose, onRespond, onComplete, onOccurrenceStatus, submitting }: Props) {
  if (lessons.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-400 text-sm">No upcoming lessons in the next 8 weeks.</p>
      </div>
    )
  }

  const byDate = new Map<string, UpcomingLesson[]>()
  for (const l of lessons) {
    const arr = byDate.get(l.date) ?? []
    arr.push(l)
    byDate.set(l.date, arr)
  }

  return (
    <div className="space-y-4">
      {[...byDate.entries()].map(([date, dayLessons]) => (
        <div key={date}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{formatLessonDate(date)}</p>
          <div className="space-y-2">
            {dayLessons.map((l, i) => (
              <div key={`${l.lessonRequestId}-${i}`} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-700">
                    <strong>{l.childName}</strong> with {l.parentName}
                  </p>
                  <p className="text-xs text-gray-500 shrink-0">
                    {formatTime(l.startTime)}–{formatTime(l.endTime)} EST
                  </p>
                </div>
                <TutorLessonActions
                  lesson={l}
                  onPropose={onPropose}
                  onRespond={onRespond}
                  onComplete={onComplete}
                  onOccurrenceStatus={onOccurrenceStatus}
                  submitting={submitting}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
