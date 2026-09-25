'use client'

import { useState } from 'react'
import { formatTime } from '@/lib/schedule'

export interface UpcomingLesson {
  date: string
  startTime: string
  endTime: string
  templateDate: string
  rescheduledFrom: string | null
  parentName: string
  childName: string
  lessonRequestId: string
  proposedBy: 'parent' | 'tutor' | null
  proposedDate: string | null
  proposedStartTime: string | null
  proposedEndTime: string | null
  canPropose: boolean
  canOverride: boolean
  hasPassed: boolean
}

export function formatLessonDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })
}

function TimeForm({ onSubmit, onCancel, submitting, submitLabel, hint }: {
  onSubmit: (date: string, start: string, end: string) => void
  onCancel: () => void
  submitting: boolean
  submitLabel: string
  hint?: string
}) {
  const [date, setDate] = useState('')
  const [start, setStart] = useState('16:00')
  const [end, setEnd] = useState('17:00')
  const valid = date && start < end

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
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => valid && onSubmit(date, start, end)}
          disabled={submitting || !valid}
          className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
        <button onClick={onCancel} disabled={submitting} className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  )
}

function NoteForm({ onSubmit, onCancel, submitting, submitLabel }: {
  onSubmit: (note: string) => void
  onCancel: () => void
  submitting: boolean
  submitLabel: string
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
          {submitting ? 'Saving…' : submitLabel}
        </button>
        <button onClick={onCancel} disabled={submitting} className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  )
}

type FormMode = 'propose' | 'override' | 'summary' | 'no_show' | 'cancelled' | null

interface Props {
  lesson: UpcomingLesson
  onPropose: (lessonRequestId: string, occurrenceDate: string, date: string, start: string, end: string, override: boolean) => Promise<void>
  onRespond: (lessonRequestId: string, occurrenceDate: string, action: 'approve' | 'decline') => Promise<void>
  onComplete: (lessonRequestId: string, occurrenceDate: string, summary: string) => Promise<void>
  onOccurrenceStatus: (lessonRequestId: string, occurrenceDate: string, status: 'no_show' | 'cancelled', note: string) => Promise<void>
  submitting: boolean
}

// The interactive part of a single upcoming-lesson card — proposed-time
// banners plus propose/override/complete/cancel/no-show actions. Shared by
// the Box view (rendered inline per row) and the Calendar view (rendered
// inside a detail popup), so both surfaces offer the same actions instead of
// the calendar being read-only.
export default function TutorLessonActions({ lesson: l, onPropose, onRespond, onComplete, onOccurrenceStatus, submitting }: Props) {
  const [mode, setMode] = useState<FormMode>(null)

  return (
    <>
      {l.rescheduledFrom && (
        <p className="text-xs text-gray-400 mt-1">Rescheduled from {formatLessonDate(l.rescheduledFrom)}</p>
      )}

      {l.proposedBy === 'parent' && l.proposedDate && (
        <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-2">
          <p className="text-xs text-gray-700">
            Parent suggested {formatLessonDate(l.proposedDate)}, {formatTime(l.proposedStartTime!)}–{formatTime(l.proposedEndTime!)} EST
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onRespond(l.lessonRequestId, l.templateDate, 'approve')}
              disabled={submitting}
              className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => onRespond(l.lessonRequestId, l.templateDate, 'decline')}
              disabled={submitting}
              className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1 rounded-md hover:border-gray-500 transition disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}
      {l.proposedBy === 'tutor' && l.proposedDate && (
        <p className="text-xs text-orange-600 mt-2">
          Waiting on the parent&rsquo;s approval for your suggested time — {formatLessonDate(l.proposedDate)}, {formatTime(l.proposedStartTime!)}–{formatTime(l.proposedEndTime!)} EST.
        </p>
      )}

      {mode === 'propose' && (
        <TimeForm
          submitting={submitting}
          submitLabel="Suggest time"
          hint="Consider emailing to coordinate first — this won't take effect until the parent approves it."
          onCancel={() => setMode(null)}
          onSubmit={async (d, s, e) => { await onPropose(l.lessonRequestId, l.templateDate, d, s, e, false); setMode(null) }}
        />
      )}
      {mode === 'override' && (
        <TimeForm
          submitting={submitting}
          submitLabel="Change time"
          hint="This applies immediately, no approval needed — the parent will just be notified."
          onCancel={() => setMode(null)}
          onSubmit={async (d, s, e) => { await onPropose(l.lessonRequestId, l.templateDate, d, s, e, true); setMode(null) }}
        />
      )}
      {mode === 'summary' && (
        <NoteForm
          submitting={submitting}
          submitLabel="Save summary"
          onCancel={() => setMode(null)}
          onSubmit={async note => { await onComplete(l.lessonRequestId, l.templateDate, note); setMode(null) }}
        />
      )}
      {(mode === 'no_show' || mode === 'cancelled') && (
        <NoteForm
          submitting={submitting}
          submitLabel={mode === 'no_show' ? 'Mark no-show' : 'Cancel lesson'}
          onCancel={() => setMode(null)}
          onSubmit={async note => { await onOccurrenceStatus(l.lessonRequestId, l.templateDate, mode as 'no_show' | 'cancelled', note); setMode(null) }}
        />
      )}

      {!mode && !l.proposedBy && (
        <div className="flex gap-3 mt-2 flex-wrap">
          <button
            onClick={() => setMode('summary')}
            className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-md hover:bg-gray-700 transition"
          >
            Complete &amp; write summary
          </button>
          {l.hasPassed ? (
            <button
              onClick={() => setMode('no_show')}
              className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1 rounded-md hover:border-gray-500 transition"
            >
              Mark no-show
            </button>
          ) : (
            <button
              onClick={() => setMode('cancelled')}
              className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1 rounded-md hover:border-gray-500 transition"
            >
              Cancel this lesson
            </button>
          )}
          {l.canPropose && (
            <button onClick={() => setMode('propose')} className="text-xs text-gray-500 underline hover:text-gray-800">
              Suggest new time
            </button>
          )}
          {l.canOverride && (
            <button onClick={() => setMode('override')} className="text-xs text-gray-500 underline hover:text-gray-800">
              Override time
            </button>
          )}
        </div>
      )}
    </>
  )
}
