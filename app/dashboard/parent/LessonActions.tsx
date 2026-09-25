'use client'

import { useState, useEffect } from 'react'
import { formatTime, isRangeWithinWindows } from '@/lib/schedule'

export interface UpcomingLesson {
  date: string
  startTime: string
  endTime: string
  templateDate: string
  rescheduledFrom: string | null
  tutorUserId: string
  tutorName: string
  childName: string
  lessonRequestId: string
  proposedBy: 'parent' | 'tutor' | null
  proposedDate: string | null
  proposedStartTime: string | null
  proposedEndTime: string | null
  canPropose: boolean
}

export function formatLessonDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })
}

// Fetches and enforces the tutor's real availability instead of accepting
// any date/time pair — mirrors the initial booking flow (BookingModal), since
// the tutor may not even be available at all on some days.
function ProposeForm({ tutorUserId, lessonRequestId, onSubmit, onCancel, submitting }: {
  tutorUserId: string
  lessonRequestId: string
  onSubmit: (date: string, start: string, end: string) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [windows, setWindows] = useState<Record<string, { startTime: string; endTime: string }[]>>({})
  const [loadingWindows, setLoadingWindows] = useState(true)
  const [date, setDate] = useState('')
  const [start, setStart] = useState('16:00')
  const [end, setEnd] = useState('17:00')

  useEffect(() => {
    const today = new Date()
    const from = today.toISOString().slice(0, 10)
    const to = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    fetch(`/api/tutors/${tutorUserId}/windows?from=${from}&to=${to}&excludeLessonRequestId=${lessonRequestId}`)
      .then(r => r.json())
      .then(d => setWindows(d.windows ?? {}))
      .catch(() => {})
      .finally(() => setLoadingWindows(false))
  }, [tutorUserId, lessonRequestId])

  const dayWindows = date ? (windows[date] ?? []) : []
  const endAfterStart = start < end
  const withinWindow = isRangeWithinWindows(start, end, dayWindows)
  const valid = !!date && endAfterStart && withinWindow

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2 items-center flex-wrap">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        <input type="time" value={start} onChange={e => setStart(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        <span className="text-gray-400">–</span>
        <input type="time" value={end} onChange={e => setEnd(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>

      {date && (
        loadingWindows ? (
          <p className="text-xs text-gray-400">Checking the tutor&rsquo;s availability…</p>
        ) : dayWindows.length > 0 ? (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 mb-0.5">Tutor available:</p>
            {dayWindows.map((w, i) => (
              <span key={i} className="text-xs text-gray-700 font-medium">
                {i > 0 && <span className="text-gray-400 mx-1">·</span>}
                {formatTime(w.startTime)}–{formatTime(w.endTime)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-red-500">The tutor isn&rsquo;t available at all on this date.</p>
        )
      )}
      {date && !endAfterStart && (
        <p className="text-xs text-red-500">End time must be after start time.</p>
      )}
      {date && endAfterStart && dayWindows.length > 0 && !withinWindow && (
        <p className="text-xs text-red-500">That time isn&rsquo;t within the tutor&rsquo;s available window that day.</p>
      )}

      <p className="text-xs text-gray-500">
        Consider emailing to coordinate first — this won&rsquo;t take effect until they approve it.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => valid && onSubmit(date, start, end)}
          disabled={submitting || !valid}
          className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Suggest time'}
        </button>
        <button onClick={onCancel} disabled={submitting} className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  )
}

function CancelForm({ onSubmit, onCancel, submitting }: {
  onSubmit: (note: string) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [text, setText] = useState('')
  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        placeholder="Optional note…"
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(text.trim())}
          disabled={submitting}
          className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
        >
          {submitting ? 'Cancelling…' : 'Cancel lesson'}
        </button>
        <button onClick={onCancel} disabled={submitting} className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5">
          Never mind
        </button>
      </div>
    </div>
  )
}

type Mode = 'propose' | 'cancel' | null

interface Props {
  lesson: UpcomingLesson
  onPropose: (lessonRequestId: string, occurrenceDate: string, date: string, start: string, end: string) => Promise<void>
  onRespond: (lessonRequestId: string, occurrenceDate: string, action: 'approve' | 'decline') => Promise<void>
  onCancel: (lessonRequestId: string, occurrenceDate: string, note: string) => Promise<void>
  submitting: boolean
  // 'popup' (the Calendar view's detail popup) gets larger, pill-shaped
  // buttons — a bigger surface than the Box view's inline row, so the
  // default compact text-xs buttons look undersized there.
  variant?: 'compact' | 'popup'
}

// The interactive part of a single upcoming-lesson card — proposed-time
// banners plus propose/cancel actions. Shared by the Box view (rendered
// inline per row) and the Calendar view (rendered inside a detail popup),
// so both surfaces offer the same actions instead of the calendar being
// read-only.
export default function ParentLessonActions({ lesson: l, onPropose, onRespond, onCancel, submitting, variant = 'compact' }: Props) {
  const [mode, setMode] = useState<Mode>(null)
  const isPopup = variant === 'popup'
  const primaryBtn = isPopup
    ? 'text-sm bg-gray-900 text-white px-4 py-2 rounded-full hover:bg-gray-700 transition disabled:opacity-50'
    : 'text-xs bg-gray-900 text-white px-2.5 py-1 rounded-md hover:bg-gray-700 transition disabled:opacity-50'
  const secondaryBtn = isPopup
    ? 'text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-full hover:border-gray-500 transition disabled:opacity-50'
    : 'text-xs border border-gray-300 text-gray-600 px-2.5 py-1 rounded-md hover:border-gray-500 transition disabled:opacity-50'
  const linkBtn = isPopup
    ? 'text-sm text-gray-600 underline hover:text-gray-900'
    : 'text-xs text-gray-500 underline hover:text-gray-800'

  return (
    <>
      {l.rescheduledFrom && (
        <p className="text-xs text-gray-400 mt-1">Rescheduled from {formatLessonDate(l.rescheduledFrom)}</p>
      )}

      {l.proposedBy === 'tutor' && l.proposedDate && (
        <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-2">
          <p className="text-xs text-gray-700">
            Tutor suggested {formatLessonDate(l.proposedDate)}, {formatTime(l.proposedStartTime!)}–{formatTime(l.proposedEndTime!)} EST
          </p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onRespond(l.lessonRequestId, l.templateDate, 'approve')} disabled={submitting} className={primaryBtn}>
              Approve
            </button>
            <button onClick={() => onRespond(l.lessonRequestId, l.templateDate, 'decline')} disabled={submitting} className={secondaryBtn}>
              Decline
            </button>
          </div>
        </div>
      )}
      {l.proposedBy === 'parent' && l.proposedDate && (
        <p className="text-xs text-orange-600 mt-2">
          Waiting on the tutor&rsquo;s approval for your suggested time — {formatLessonDate(l.proposedDate)}, {formatTime(l.proposedStartTime!)}–{formatTime(l.proposedEndTime!)} EST.
        </p>
      )}

      {!l.proposedBy && (
        mode === 'propose' ? (
          <ProposeForm
            tutorUserId={l.tutorUserId}
            lessonRequestId={l.lessonRequestId}
            submitting={submitting}
            onCancel={() => setMode(null)}
            onSubmit={async (d, s, e) => { await onPropose(l.lessonRequestId, l.templateDate, d, s, e); setMode(null) }}
          />
        ) : mode === 'cancel' ? (
          <CancelForm
            submitting={submitting}
            onCancel={() => setMode(null)}
            onSubmit={async note => { await onCancel(l.lessonRequestId, l.templateDate, note); setMode(null) }}
          />
        ) : (
          <div className={`flex items-center gap-3 flex-wrap ${isPopup ? 'mt-3' : 'mt-2'}`}>
            <button onClick={() => setMode('cancel')} className={isPopup ? secondaryBtn : linkBtn}>
              Cancel
            </button>
            {l.canPropose ? (
              <button onClick={() => setMode('propose')} className={linkBtn}>
                Suggest a new time
              </button>
            ) : (
              <p className="text-xs text-gray-400">Within 48 hours — you can still cancel, but rescheduling isn&rsquo;t available.</p>
            )}
          </div>
        )
      )}
    </>
  )
}
