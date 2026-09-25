'use client'

import { useState, useEffect } from 'react'
import type { LessonRequest, LessonOccurrence } from '@/lib/types'
import { formatTime } from '@/lib/schedule'
import { isAwaitingParentApproval, isHistoryBooking } from '@/lib/lessons'
import AddStudentModal from './AddStudentModal'

type EnrichedRequest = LessonRequest & {
  parentName: string
  parentEmail: string
  recurrenceLabel: string
  occurrences: LessonOccurrence[]
  nextOccurrence: { date: string; startTime: string; endTime: string } | null
  canAddStudent: boolean
}

type Tab = 'new' | 'in_progress' | 'history'
type ActionKind = 'summary' | 'decline'

const STATUS_LABELS: Record<LessonRequest['status'], string> = {
  pending: 'New',
  in_progress: 'In Progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<LessonRequest['status'], string> = {
  pending: 'bg-orange-100 text-orange-700',
  in_progress: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const OCCURRENCE_STATUS_LABELS: Record<string, string> = {
  no_show: 'No-show',
  cancelled: 'Cancelled',
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

// A card's own status badge, overridden for the one case where "History"
// isn't a real status — see isHistoryBooking in lib/lessons.
function statusBadge(req: EnrichedRequest): { label: string; color: string } {
  if (req.status === 'in_progress' && req.acceptedAt) {
    return { label: 'Scheduled', color: 'bg-green-100 text-green-700' }
  }
  return { label: STATUS_LABELS[req.status], color: STATUS_COLORS[req.status] }
}

const awaitingSummary = (req: EnrichedRequest) => req.occurrences.filter(o => o.status === 'completed' && !o.summary)
const completedWithSummary = (req: EnrichedRequest) => req.occurrences.filter(o => o.status === 'completed' && o.summary)
const skippedOccurrences = (req: EnrichedRequest) => req.occurrences.filter(o => o.status === 'cancelled' || o.status === 'no_show')

// Reused for writing a summary (required text) and for a decline reason (also required).
function NoteForm({ onSubmit, onCancel, submitting, required = true, placeholder, submitLabel }: {
  onSubmit: (note: string) => void
  onCancel: () => void
  submitting: boolean
  required?: boolean
  placeholder: string
  submitLabel: string
}) {
  const [text, setText] = useState('')
  const canSubmit = !required || !!text.trim()
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      <div className="flex gap-2">
        <button
          onClick={() => canSubmit && onSubmit(text.trim())}
          disabled={submitting || !canSubmit}
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

// Correct a one-time request's date/time, e.g. to match what was actually
// agreed with the parent over email.
function EditTimeForm({ initialDate, initialStart, initialEnd, onSubmit, onCancel, submitting }: {
  initialDate: string
  initialStart: string
  initialEnd: string
  onSubmit: (date: string, start: string, end: string) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [date, setDate] = useState(initialDate)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const valid = date && start && end && start < end

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center flex-wrap">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        <input type="time" value={start} onChange={e => setStart(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        <span className="text-gray-400">–</span>
        <input type="time" value={end} onChange={e => setEnd(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      {!valid && <p className="text-xs text-red-500">End time must be after start time.</p>}
      <div className="flex gap-2">
        <button
          onClick={() => valid && onSubmit(date, start, end)}
          disabled={submitting || !valid}
          className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save time'}
        </button>
        <button onClick={onCancel} disabled={submitting} className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  )
}

interface Props {
  onPendingCountChange?: (count: number) => void
}

export default function LessonRequestsPanel({ onPendingCountChange }: Props) {
  const [requests, setRequests] = useState<EnrichedRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('new')
  const [updating, setUpdating] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<{ key: string; kind: ActionKind } | null>(null)
  const [submittingAction, setSubmittingAction] = useState(false)
  const [editingTimeFor, setEditingTimeFor] = useState<string | null>(null)
  const [addStudentFor, setAddStudentFor] = useState<{ parentUserId: string; childName: string } | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    return fetch('/api/tutor/requests')
      .then(r => r.json())
      .then(d => {
        setRequests(d.requests ?? [])
        onPendingCountChange?.(d.pendingCount ?? 0)
      })
      .catch(() => setError('Failed to load requests.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Every submit* action below stays "busy" (disabled/"Saving…") across both
  // the mutation AND the follow-up load() refetch, and only clears its
  // active-form state once that refetch has actually landed — otherwise a
  // button/form can flash back to its normal state seconds before the item
  // it mutated visibly updates, reading as if nothing happened.
  const updateStatus = async (id: string, status: 'in_progress' | 'cancelled') => {
    setUpdating(id)
    setError('')
    const res = await fetch(`/api/lessons/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      await load()
    } else {
      setError('Failed to update. Try again.')
    }
    setUpdating(null)
  }

  const submitDecline = async (id: string, reason: string) => {
    setSubmittingAction(true)
    setError('')
    const res = await fetch(`/api/lessons/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', reason }),
    })
    if (res.ok) {
      await load()
      setActiveAction(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to decline.')
    }
    setSubmittingAction(false)
  }

  const submitAccept = async (id: string) => {
    setUpdating(id)
    setError('')
    const res = await fetch(`/api/lessons/${id}/accept`, { method: 'POST' })
    if (res.ok) {
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to accept.')
    }
    setUpdating(null)
  }

  const submitSummary = async (lessonRequestId: string, occurrenceDate: string, summary: string) => {
    setSubmittingAction(true)
    setError('')
    const res = await fetch('/api/tutor/lesson-summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonRequestId, occurrenceDate, summary }),
    })
    if (res.ok) {
      await load()
      setActiveAction(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? "Couldn't save summary, please try again later.")
    }
    setSubmittingAction(false)
  }

  const submitEditTime = async (id: string, requestedDate: string, requestedStartTime: string, requestedEndTime: string) => {
    setSubmittingAction(true)
    setError('')
    const res = await fetch(`/api/lessons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedDate, requestedStartTime, requestedEndTime }),
    })
    if (res.ok) {
      await load()
      setEditingTimeFor(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to update the lesson time.')
    }
    setSubmittingAction(false)
  }

  const filtered = requests.filter(r => {
    if (tab === 'new') return r.status === 'pending'
    if (tab === 'in_progress') return r.status === 'in_progress' && !r.acceptedAt
    return isHistoryBooking(r)
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const inProgressCount = requests.filter(r => r.status === 'in_progress' && !r.acceptedAt).length

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-full transition ${
      tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
    }`

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setTab('new')} className={tabCls('new')}>
          New {pendingCount > 0 && <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>}
        </button>
        <button onClick={() => setTab('in_progress')} className={tabCls('in_progress')}>
          In Progress {inProgressCount > 0 && <span className="ml-1 text-xs text-blue-600">({inProgressCount})</span>}
        </button>
        <button onClick={() => setTab('history')} className={tabCls('history')}>
          History
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">
            {tab === 'new' ? 'No new requests.' : tab === 'in_progress' ? 'No requests in progress.' : 'No history yet.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(req => {
          const badge = statusBadge(req)

          return (
          <div key={req.id} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{req.childName}</p>
                <p className="text-xs text-gray-500">Parent: {req.parentName} · <a href={`mailto:${req.parentEmail}`} className="underline hover:text-gray-700">{req.parentEmail}</a></p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${badge.color}`}>
                {badge.label}
              </span>
            </div>

            <p className="text-sm text-gray-700 mb-1">
              {req.repeatType === 'once'
                ? `${formatDate(req.requestedDate)} · ${formatTime(req.requestedStartTime)}–${formatTime(req.requestedEndTime)} EST`
                : req.recurrenceLabel}
            </p>

            {req.message && (
              <p className="text-sm text-gray-500 italic border-l-2 border-gray-200 pl-3 my-2">
                &ldquo;{req.message}&rdquo;
              </p>
            )}

            {req.status === 'cancelled' && req.declineReason && (
              <p className="text-xs text-gray-500 mt-1">Declined: {req.declineReason}</p>
            )}

            {req.status === 'pending' && (
              isAwaitingParentApproval(req) ? (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 shrink-0">
                    Awaiting parent&rsquo;s approval
                  </span>
                  <button
                    onClick={() => updateStatus(req.id, 'cancelled')}
                    disabled={updating === req.id}
                    className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-md hover:border-gray-500 transition disabled:opacity-50"
                  >
                    Withdraw
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => updateStatus(req.id, 'in_progress')}
                    disabled={updating === req.id}
                    className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                </div>
              )
            )}

            {req.repeatType === 'once' && (req.status === 'pending' || req.status === 'in_progress') && (
              editingTimeFor === req.id ? (
                <div className="mt-3">
                  <EditTimeForm
                    initialDate={req.requestedDate}
                    initialStart={req.requestedStartTime}
                    initialEnd={req.requestedEndTime}
                    submitting={submittingAction}
                    onCancel={() => setEditingTimeFor(null)}
                    onSubmit={(date, start, end) => submitEditTime(req.id, date, start, end)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setEditingTimeFor(req.id)}
                  className="text-xs text-gray-500 underline hover:text-gray-800 mt-2"
                >
                  Edit time
                </button>
              )
            )}

            {req.status === 'in_progress' && !req.acceptedAt && (
              activeAction?.key === req.id && activeAction.kind === 'decline' ? (
                <div className="mt-3">
                  <NoteForm
                    submitting={submittingAction}
                    onCancel={() => setActiveAction(null)}
                    onSubmit={reason => submitDecline(req.id, reason)}
                    placeholder="Reason for declining (shared with the parent)…"
                    submitLabel="Decline"
                  />
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => submitAccept(req.id)}
                    disabled={updating === req.id}
                    className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setActiveAction({ key: req.id, kind: 'decline' })}
                    disabled={updating === req.id}
                    className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-md hover:border-gray-500 transition disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              )
            )}

            {isHistoryBooking(req) && req.occurrences.length > 0 && (
              <div className="mt-3 space-y-3">
                {awaitingSummary(req).map(occ => (
                  <div key={occ.id} className="border border-orange-200 bg-orange-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700 mb-2">
                      Lesson on {formatDate(occ.occurrenceDate)} needs a summary.
                    </p>
                    {activeAction?.key === `${req.id}|${occ.occurrenceDate}` ? (
                      <NoteForm
                        submitting={submittingAction}
                        onCancel={() => setActiveAction(null)}
                        onSubmit={summary => submitSummary(req.id, occ.occurrenceDate, summary)}
                        placeholder="What did you work on in this lesson?"
                        submitLabel="Save summary"
                      />
                    ) : (
                      <button
                        onClick={() => setActiveAction({ key: `${req.id}|${occ.occurrenceDate}`, kind: 'summary' })}
                        className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition"
                      >
                        Write summary
                      </button>
                    )}
                  </div>
                ))}
                {completedWithSummary(req).map(occ => (
                  <div key={occ.id} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">{formatDate(occ.occurrenceDate)}</p>
                    <p className="text-sm text-gray-600 italic">&ldquo;{occ.summary}&rdquo;</p>
                  </div>
                ))}
                {skippedOccurrences(req).map(occ => (
                  <p key={occ.id} className="text-xs text-gray-400">
                    {OCCURRENCE_STATUS_LABELS[occ.status]} · {formatDate(occ.occurrenceDate)}
                    {occ.summary && ` — "${occ.summary}"`}
                  </p>
                ))}
              </div>
            )}

            {/* Cancelling a recurring series lives on the student's recurring-
                schedule detail view (MyStudentsPanel -> StudentDetailModal),
                next to "Edit schedule" — not here. A one-time booking has no
                such view, so its single-lesson cancel stays on this card. */}
            {req.status === 'in_progress' && req.acceptedAt && req.repeatType === 'once' && (
              <button
                onClick={() => updateStatus(req.id, 'cancelled')}
                disabled={updating === req.id}
                className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-md hover:border-gray-500 transition disabled:opacity-50 mt-3"
              >
                Cancel lesson
              </button>
            )}

            {req.canAddStudent && (
              <button
                onClick={() => setAddStudentFor({ parentUserId: req.parentUserId, childName: req.childName })}
                className="text-sm text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md hover:border-gray-500 transition mt-3"
              >
                + Add student
              </button>
            )}
          </div>
          )
        })}
      </div>

      {addStudentFor && (
        <AddStudentModal
          parentUserId={addStudentFor.parentUserId}
          childName={addStudentFor.childName}
          onClose={() => setAddStudentFor(null)}
          onAdded={() => { setAddStudentFor(null); load() }}
        />
      )}
    </div>
  )
}
