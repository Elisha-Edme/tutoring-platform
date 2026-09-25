'use client'

import { useState, useEffect } from 'react'
import UpcomingLessonsBoxView, { type UpcomingLesson } from './UpcomingLessonsBoxView'
import UpcomingLessonsCalendar from './UpcomingLessonsCalendar'

type View = 'box' | 'calendar'

export default function UpcomingLessonsPanel() {
  const [lessons, setLessons] = useState<UpcomingLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('box')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    return fetch('/api/tutor/upcoming-lessons')
      .then(r => r.json())
      .then(d => setLessons(d.lessons ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Every handler below stays "busy" (disabled/"Saving…", form still open)
  // across both the mutation AND the follow-up load() refetch — otherwise a
  // button can flash back to normal seconds before the lesson it mutated
  // actually disappears/updates in the list, reading as if nothing happened.
  const onPropose = async (lessonRequestId: string, occurrenceDate: string, date: string, start: string, end: string, override: boolean) => {
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/lessons/${lessonRequestId}/occurrences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        occurrenceDate, action: override ? 'override' : 'propose',
        proposedDate: date, proposedStartTime: start, proposedEndTime: end,
      }),
    })
    if (res.ok) await load()
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to update the time.')
    }
    setSubmitting(false)
  }

  const onRespond = async (lessonRequestId: string, occurrenceDate: string, action: 'approve' | 'decline') => {
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/lessons/${lessonRequestId}/occurrences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ occurrenceDate, action }),
    })
    if (res.ok) await load()
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to respond.')
    }
    setSubmitting(false)
  }

  const onComplete = async (lessonRequestId: string, occurrenceDate: string, summary: string) => {
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/tutor/lesson-summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonRequestId, occurrenceDate, summary: summary || 'Lesson completed.' }),
    })
    if (res.ok) await load()
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? "Couldn't save summary, please try again later.")
    }
    setSubmitting(false)
  }

  const onOccurrenceStatus = async (lessonRequestId: string, occurrenceDate: string, status: 'no_show' | 'cancelled', note: string) => {
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/tutor/occurrences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonRequestId, occurrenceDate, status, note }),
    })
    if (res.ok) await load()
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? `Failed to mark as ${status === 'no_show' ? 'no-show' : 'cancelled'}.`)
    }
    setSubmitting(false)
  }

  const tabCls = (v: View) =>
    `px-4 py-2 text-sm font-medium rounded-full transition ${
      view === v ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
    }`

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('box')} className={tabCls('box')}>Box view</button>
        <button onClick={() => setView('calendar')} className={tabCls('calendar')}>Calendar</button>
      </div>
      {view === 'box'
        ? (
          <UpcomingLessonsBoxView
            lessons={lessons}
            onPropose={onPropose}
            onRespond={onRespond}
            onComplete={onComplete}
            onOccurrenceStatus={onOccurrenceStatus}
            submitting={submitting}
          />
        )
        : (
          <UpcomingLessonsCalendar
            lessons={lessons}
            onPropose={onPropose}
            onRespond={onRespond}
            onComplete={onComplete}
            onOccurrenceStatus={onOccurrenceStatus}
            submitting={submitting}
          />
        )}
    </div>
  )
}
