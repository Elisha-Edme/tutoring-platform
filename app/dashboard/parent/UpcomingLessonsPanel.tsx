'use client'

import { useState, useEffect } from 'react'
import UpcomingLessonsBoxView, { type UpcomingLesson } from './UpcomingLessonsBoxView'
import UpcomingLessonsCalendar from './UpcomingLessonsCalendar'

type View = 'box' | 'calendar'

interface Props {
  refreshKey?: number
}

export default function UpcomingLessonsPanel({ refreshKey }: Props) {
  const [lessons, setLessons] = useState<UpcomingLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('calendar')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    return fetch('/api/parent/upcoming-lessons')
      .then(r => r.json())
      .then(d => setLessons(d.lessons ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [refreshKey])

  // Every handler stays "busy" across both the mutation and the follow-up
  // load() refetch, so the calling form only closes once the list has
  // actually updated (see UpcomingLessonsBoxView's onSubmit wrappers).
  const onPropose = async (lessonRequestId: string, occurrenceDate: string, date: string, start: string, end: string) => {
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/lessons/${lessonRequestId}/occurrences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ occurrenceDate, action: 'propose', proposedDate: date, proposedStartTime: start, proposedEndTime: end }),
    })
    if (res.ok) await load()
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to suggest a new time.')
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

  const onCancel = async (lessonRequestId: string, occurrenceDate: string, note: string) => {
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/tutor/occurrences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonRequestId, occurrenceDate, status: 'cancelled', note }),
    })
    if (res.ok) await load()
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to cancel the lesson.')
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
        <button onClick={() => setView('calendar')} className={tabCls('calendar')}>Calendar</button>
        <button onClick={() => setView('box')} className={tabCls('box')}>Box view</button>
      </div>
      {view === 'box'
        ? <UpcomingLessonsBoxView lessons={lessons} onPropose={onPropose} onRespond={onRespond} onCancel={onCancel} submitting={submitting} />
        : <UpcomingLessonsCalendar lessons={lessons} onPropose={onPropose} onRespond={onRespond} onCancel={onCancel} submitting={submitting} />}
    </div>
  )
}
