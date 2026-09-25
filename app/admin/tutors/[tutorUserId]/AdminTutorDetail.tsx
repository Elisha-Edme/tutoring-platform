'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type {
  TutorProfile, TutorAvailabilityRule, AvailabilityException,
  LessonRequest, LessonOccurrence, TutorStudent,
} from '@/lib/types'
import { formatTime } from '@/lib/schedule'
import { formatHours } from '@/lib/lessons'
import { getTutorGradient } from '@/lib/gradient'
import { Avatar } from '@/app/tutors/TutorDetailCard'
import StarRating from '@/components/StarRating'
import AdminWeeklyScheduleGrid from '../../AdminWeeklyScheduleGrid'

type EnrichedRule = TutorAvailabilityRule & { label: string }
type EnrichedException = AvailabilityException & { childName: string }
type EnrichedStudent = TutorStudent & {
  parentName: string
  instruments: string[]
  grade: string
  recurringSchedule: { lessonRequestId: string; recurrenceLabel: string } | null
}
type EnrichedRequest = LessonRequest & { parentName: string; recurrenceLabel: string }
type EnrichedOccurrence = LessonOccurrence & { childName: string; parentName: string }

interface Detail {
  profile: TutorProfile
  stats: { lessonsCompleted: number; hoursCompleted: number; rating: number; reviewCount: number }
  availability: { rules: EnrichedRule[]; exceptions: EnrichedException[] }
  students: EnrichedStudent[]
  lessonRequests: EnrichedRequest[]
  history: EnrichedOccurrence[]
}

type Tab = 'overview' | 'availability' | 'students' | 'requests' | 'history'

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

export default function AdminTutorDetail({ tutorUserId }: { tutorUserId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    fetch(`/api/admin/tutors/${tutorUserId}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setDetail)
      .catch(() => setError('Failed to load this tutor.'))
      .finally(() => setLoading(false))
  }, [tutorUserId])

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (error || !detail) return <p className="text-sm text-red-600">{error || 'Not found.'}</p>

  const { profile, stats, availability, students, lessonRequests, history } = detail

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-full transition ${
      tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <div>
      <Link href="/admin/tutors" className="text-sm text-gray-500 hover:text-gray-800">&larr; Back to tutors</Link>

      <div className="flex items-center gap-4 mt-4 mb-8">
        <div className="rounded-full" style={{ background: getTutorGradient(profile.userId) }}>
          <Avatar name={profile.name} url={profile.photoUrl} size="lg" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
          <p className="text-sm text-gray-500">{profile.email}</p>
          <p className="text-sm text-gray-500">{profile.instruments.join(', ')}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab('overview')} className={tabCls('overview')}>Overview</button>
        <button onClick={() => setTab('availability')} className={tabCls('availability')}>Availability</button>
        <button onClick={() => setTab('students')} className={tabCls('students')}>
          Students {students.length > 0 && `(${students.length})`}
        </button>
        <button onClick={() => setTab('requests')} className={tabCls('requests')}>
          Requests {lessonRequests.length > 0 && `(${lessonRequests.length})`}
        </button>
        <button onClick={() => setTab('history')} className={tabCls('history')}>
          History {history.length > 0 && `(${history.length})`}
        </button>
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Lessons</p>
              <p className="text-lg font-semibold text-gray-900">{stats.lessonsCompleted}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Hours</p>
              <p className="text-lg font-semibold text-gray-900">{formatHours(stats.hoursCompleted)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Rating</p>
              <StarRating rating={stats.rating} reviewCount={stats.reviewCount} />
            </div>
          </div>
          {profile.bio && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bio</p>
              <p className="text-sm text-gray-700">{profile.bio}</p>
            </div>
          )}
          {profile.school && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">School</p>
              <p className="text-sm text-gray-700">{profile.school}</p>
            </div>
          )}
          {profile.credentials && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Credentials</p>
              <p className="text-sm text-gray-700">{profile.credentials}</p>
            </div>
          )}
          {profile.location && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Location</p>
              <p className="text-sm text-gray-700">{profile.location}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'availability' && (
        <div className="space-y-8">
          {availability.rules.length === 0 && availability.exceptions.filter(e => e.type === 'booked').length === 0 ? (
            <EmptyState text="No availability set." />
          ) : (
            <AdminWeeklyScheduleGrid
              rules={availability.rules}
              bookedExceptions={availability.exceptions.filter(e => e.type === 'booked')}
            />
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Exceptions</h3>
            {availability.exceptions.length === 0 ? (
              <p className="text-sm text-gray-400">No exceptions.</p>
            ) : (
              <div className="space-y-1">
                {availability.exceptions.map(exc => (
                  <div key={exc.id} className="flex items-center justify-between gap-3 text-sm text-gray-600">
                    {exc.type === 'booked' ? (
                      <span>Booked: {exc.childName || 'a student'}</span>
                    ) : (
                      <span>
                        {exc.startDate === exc.endDate ? exc.startDate : `${exc.startDate} → ${exc.endDate}`}
                        {' — '}
                        {exc.type === 'blocked' ? 'Off' : `${formatTime(exc.startTime)}–${formatTime(exc.endTime)}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'students' && (
        students.length === 0 ? <EmptyState text="No students yet." /> : (
          <div className="space-y-2">
            {students.map(s => (
              <div key={`${s.parentUserId}-${s.childName}`} className="border border-gray-100 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{s.childName}</p>
                <p className="text-xs text-gray-500">Parent: {s.parentName}</p>
                {s.grade && <p className="text-xs text-gray-400">{s.grade} · {s.instruments.join(', ')}</p>}
                {s.recurringSchedule && (
                  <p className="text-xs text-gray-400 mt-1">{s.recurringSchedule.recurrenceLabel}</p>
                )}
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
                    <p className="text-xs text-gray-500">Parent: {req.parentName}</p>
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
                      Parent: {o.parentName} · {formatDate(o.occurrenceDate)} · {formatTime(o.occurrenceStartTime)}–{formatTime(o.occurrenceEndTime)} EST
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
    </div>
  )
}
