'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ParentProfile, LessonRequest, LessonOccurrence } from '@/lib/types'
import { formatTime } from '@/lib/schedule'

type EnrichedRequest = LessonRequest & { tutorName: string; recurrenceLabel: string }
type EnrichedOccurrence = LessonOccurrence & { tutorName: string; childName: string }

interface Detail {
  profile: ParentProfile
  lessonRequests: EnrichedRequest[]
  history: EnrichedOccurrence[]
  tutorsWorkedWith: { userId: string; name: string; instruments: string[] }[]
}

type Tab = 'overview' | 'requests' | 'history' | 'tutors'

const REQUEST_STATUS_LABELS: Record<LessonRequest['status'], string> = {
  pending: 'New', in_progress: 'In Progress', complete: 'Complete', cancelled: 'Cancelled',
}
const REQUEST_STATUS_COLORS: Record<LessonRequest['status'], string> = {
  pending: 'bg-orange-100 text-orange-700',
  in_progress: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}
const OCCURRENCE_STATUS_LABELS: Record<LessonOccurrence['status'], string> = {
  upcoming: 'Upcoming', completed: 'Completed', no_show: 'No-show', cancelled: 'Cancelled',
}
const OCCURRENCE_STATUS_COLORS: Record<LessonOccurrence['status'], string> = {
  upcoming: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  no_show: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

const EmptyState = ({ text }: { text: string }) => (
  <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
    <p className="text-gray-400 text-sm">{text}</p>
  </div>
)

export default function AdminParentDetail({ parentUserId }: { parentUserId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    fetch(`/api/admin/parents/${parentUserId}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setDetail)
      .catch(() => setError('Failed to load this parent.'))
      .finally(() => setLoading(false))
  }, [parentUserId])

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (error || !detail) return <p className="text-sm text-red-600">{error || 'Not found.'}</p>

  const { profile, lessonRequests, history, tutorsWorkedWith } = detail

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-full transition ${
      tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <div>
      <Link href="/admin/parents" className="text-sm text-gray-500 hover:text-gray-800">&larr; Back to parents</Link>

      <div className="mt-4 mb-8">
        <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
        <p className="text-sm text-gray-500">{profile.email}</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab('overview')} className={tabCls('overview')}>Overview</button>
        <button onClick={() => setTab('requests')} className={tabCls('requests')}>
          Requests {lessonRequests.length > 0 && `(${lessonRequests.length})`}
        </button>
        <button onClick={() => setTab('history')} className={tabCls('history')}>
          History {history.length > 0 && `(${history.length})`}
        </button>
        <button onClick={() => setTab('tutors')} className={tabCls('tutors')}>
          Tutors {tutorsWorkedWith.length > 0 && `(${tutorsWorkedWith.length})`}
        </button>
      </div>

      {tab === 'overview' && (
        profile.children.length === 0 ? <EmptyState text="No children added yet." /> : (
          <div className="space-y-2">
            {profile.children.map(c => (
              <div key={c.name} className="border border-gray-100 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500">{c.grade} · {c.instruments.join(', ')}</p>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'requests' && (
        lessonRequests.length === 0 ? <EmptyState text="No lesson requests." /> : (
          <div className="space-y-3">
            {lessonRequests.map(req => (
              <div key={req.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{req.childName}</p>
                    <p className="text-xs text-gray-500">Tutor: {req.tutorName}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${REQUEST_STATUS_COLORS[req.status]}`}>
                    {REQUEST_STATUS_LABELS[req.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  {req.repeatType === 'once'
                    ? `${formatDate(req.requestedDate)} · ${formatTime(req.requestedStartTime)}–${formatTime(req.requestedEndTime)} EST`
                    : req.recurrenceLabel}
                </p>
                {req.status === 'cancelled' && req.declineReason && (
                  <p className="text-xs text-gray-500 mt-1">Declined: {req.declineReason}</p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'history' && (
        history.length === 0 ? <EmptyState text="No lesson history yet." /> : (
          <div className="space-y-3">
            {history.map(o => (
              <div key={o.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{o.childName}</p>
                    <p className="text-xs text-gray-500">
                      Tutor: {o.tutorName} · {formatDate(o.occurrenceDate)} · {formatTime(o.occurrenceStartTime)}–{formatTime(o.occurrenceEndTime)} EST
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${OCCURRENCE_STATUS_COLORS[o.status]}`}>
                    {OCCURRENCE_STATUS_LABELS[o.status]}
                  </span>
                </div>
                {o.summary && (
                  <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3 mt-2">&ldquo;{o.summary}&rdquo;</p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'tutors' && (
        tutorsWorkedWith.length === 0 ? <EmptyState text="No tutors yet." /> : (
          <div className="space-y-2">
            {tutorsWorkedWith.map(t => (
              <div key={t.userId} className="border border-gray-100 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">{t.instruments.join(', ')}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
