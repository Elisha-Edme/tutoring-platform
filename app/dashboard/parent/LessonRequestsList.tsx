'use client'

import { useState, useEffect } from 'react'
import type { LessonRequest, LessonOccurrence } from '@/lib/types'
import { formatTime } from '@/lib/schedule'
import { isAwaitingParentApproval, isHistoryBooking, getReviewableTutors } from '@/lib/lessons'
import ReviewCard from '@/components/ReviewCard'
import ReviewModal from './ReviewModal'
import Link from 'next/link'

interface Review {
  rating: number
  comment: string
  createdAt: string
}

interface EnrichedRequest extends LessonRequest {
  tutorName: string
  review: Review | null
  hasCompletedOccurrence: boolean
  recurrenceLabel: string
  occurrences: LessonOccurrence[]
  nextOccurrence: { date: string; startTime: string; endTime: string } | null
}

type Tab = 'upcoming' | 'history'

const STATUS_LABELS: Record<LessonRequest['status'], string> = {
  pending: 'Pending',
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

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Mirrors the tutor dashboard's statusBadge — "History" isn't a real status,
// see isHistoryBooking in lib/lessons.
function statusBadge(req: EnrichedRequest): { label: string; color: string } {
  if (req.status === 'in_progress' && req.acceptedAt) {
    return { label: 'Scheduled', color: 'bg-green-100 text-green-700' }
  }
  if (isAwaitingParentApproval(req)) {
    return { label: 'Awaiting your approval', color: STATUS_COLORS.pending }
  }
  return { label: STATUS_LABELS[req.status], color: STATUS_COLORS[req.status] }
}

const completedWithSummary = (req: EnrichedRequest) => req.occurrences.filter(o => o.status === 'completed' && o.summary)
const skippedOccurrences = (req: EnrichedRequest) => req.occurrences.filter(o => o.status === 'cancelled' || o.status === 'no_show')

const OCCURRENCE_STATUS_LABELS: Record<string, string> = {
  no_show: 'No-show',
  cancelled: 'Cancelled',
}

export default function LessonRequestsList() {
  const [requests, setRequests] = useState<EnrichedRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [reviewing, setReviewing] = useState<EnrichedRequest | null>(null)
  const [deciding, setDeciding] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/parent/requests')
      .then(r => r.ok ? r.json() : { requests: [] })
      .then(d => setRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const decide = async (id: string, status: 'in_progress' | 'cancelled') => {
    setDeciding(id)
    setError('')
    const res = await fetch(`/api/lessons/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    } else {
      setError('Failed to update. Try again.')
    }
    setDeciding(null)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  if (requests.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-400 text-sm mb-4">No lesson requests yet.</p>
        <Link
          href="/tutors"
          className="inline-block bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition"
        >
          Find a tutor
        </Link>
      </div>
    )
  }

  const filtered = requests.filter(r => (tab === 'upcoming' ? !isHistoryBooking(r) : isHistoryBooking(r)))
  // Reviews are per tutor, not per lesson — count distinct unreviewed tutors,
  // not distinct unreviewed lesson requests.
  const unreviewedCount = getReviewableTutors(requests).length

  // hasCompletedOccurrence is per tutor, not per booking, so on its own it
  // can't tell "this card is the completed lesson" from "this tutor has some
  // unrelated completed lesson elsewhere" — a brand-new pending request with
  // a tutor the parent already has history with would otherwise show the
  // prompt too. Require isHistoryBooking(req) as well so it only ever
  // renders on a card that's actually resolved, and show it once (the first,
  // most-recent, since filtered is sorted newest-first) per tutor.
  const reviewShownFor = new Set<string>()
  const showsReviewPrompt = filtered.map(req => {
    const show = isHistoryBooking(req) && req.hasCompletedOccurrence && !reviewShownFor.has(req.tutorUserId)
    if (show) reviewShownFor.add(req.tutorUserId)
    return show
  })

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-full transition ${
      tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setTab('upcoming')} className={tabCls('upcoming')}>
          Upcoming
        </button>
        <button onClick={() => setTab('history')} className={tabCls('history')}>
          History {unreviewedCount > 0 && <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{unreviewedCount}</span>}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">
            {tab === 'upcoming' ? 'No upcoming lessons.' : 'No history yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req, i) => (
            <div key={req.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{req.childName} with {req.tutorName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {req.repeatType === 'once'
                      ? `${formatDate(req.requestedDate)} · ${formatTime(req.requestedStartTime)}–${formatTime(req.requestedEndTime)} EST`
                      : req.recurrenceLabel}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${statusBadge(req).color}`}>
                  {statusBadge(req).label}
                </span>
              </div>
              {req.message && (
                <p className="text-xs text-gray-400 italic mt-2 border-l-2 border-gray-100 pl-2">
                  &ldquo;{req.message}&rdquo;
                </p>
              )}

              {req.status === 'cancelled' && req.declineReason && (
                <p className="text-xs text-gray-400 mt-1">Declined: {req.declineReason}</p>
              )}

              {isAwaitingParentApproval(req) && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => decide(req.id, 'in_progress')}
                    disabled={deciding === req.id}
                    className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(req.id, 'cancelled')}
                    disabled={deciding === req.id}
                    className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-md hover:border-gray-500 transition disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              )}

              {req.status === 'in_progress' && req.nextOccurrence && (
                <p className="text-xs text-gray-500 mt-2">
                  Next lesson: {formatDate(req.nextOccurrence.date)} · {formatTime(req.nextOccurrence.startTime)}–{formatTime(req.nextOccurrence.endTime)} EST
                </p>
              )}

              {completedWithSummary(req).length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Lesson summaries</p>
                  {completedWithSummary(req).map(occ => (
                    <div key={occ.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                      <p className="text-xs text-gray-400 mb-1">{formatDate(occ.occurrenceDate)}</p>
                      <p className="text-sm text-gray-600 italic">&ldquo;{occ.summary}&rdquo;</p>
                    </div>
                  ))}
                </div>
              )}

              {skippedOccurrences(req).length > 0 && (
                <div className="mt-3 space-y-1">
                  {skippedOccurrences(req).map(occ => (
                    <p key={occ.id} className="text-xs text-gray-400">
                      {OCCURRENCE_STATUS_LABELS[occ.status]} · {formatDate(occ.occurrenceDate)}
                      {occ.summary && ` — "${occ.summary}"`}
                    </p>
                  ))}
                </div>
              )}

              {showsReviewPrompt[i] && (
                req.review ? (
                  <div className="mt-3">
                    <ReviewCard rating={req.review.rating} comment={req.review.comment} date={req.review.createdAt} identityLabel="Your review" />
                  </div>
                ) : (
                  <button
                    onClick={() => setReviewing(req)}
                    className="mt-3 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition"
                  >
                    Leave a review
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <ReviewModal
          tutorUserId={reviewing.tutorUserId}
          tutorName={reviewing.tutorName}
          onClose={() => setReviewing(null)}
          onSubmitted={(review: Review) => {
            // A review is per tutor, so every row for this tutor picks it up.
            setRequests(prev => prev.map(r => r.tutorUserId === reviewing.tutorUserId ? { ...r, review } : r))
            setReviewing(null)
          }}
        />
      )}
    </div>
  )
}
