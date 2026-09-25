'use client'

import { useState, useEffect } from 'react'
import type { TutorProfileWithStats } from '@/lib/types'
import { formatHours } from '@/lib/lessons'
import { getTutorGradient } from '@/lib/gradient'
import BookingModal from '@/app/tutors/BookingModal'
import TutorDetailCard, { Avatar } from '@/app/tutors/TutorDetailCard'
import StarRating from '@/components/StarRating'
import ReviewModal from './ReviewModal'

interface EnrichedStudentRequest {
  id: string
  tutorUserId: string
  tutorName: string
  childName: string
  status: 'pending' | 'approved' | 'rejected'
}

interface TutorGroup {
  tutorUserId: string
  tutorName: string
  children: Array<{ id: string; childName: string }>
}

interface Props {
  refreshKey?: number
  onRemoved?: () => void
}

export default function MyTutorsPanel({ refreshKey, onRemoved }: Props) {
  const [tutors, setTutors] = useState<TutorGroup[]>([])
  const [allTutors, setAllTutors] = useState<TutorProfileWithStats[]>([])
  const [reviewedTutorIds, setReviewedTutorIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<TutorGroup | null>(null)
  const [viewing, setViewing] = useState<TutorGroup | null>(null)
  const [reviewing, setReviewing] = useState<TutorGroup | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    Promise.all([
      fetch('/api/parent/students').then(r => r.json()),
      fetch('/api/tutors').then(r => (r.ok ? r.json() : [])),
      fetch('/api/parent/requests').then(r => (r.ok ? r.json() : { requests: [] })),
    ])
      .then(([studentsData, tutorsData, requestsData]) => {
        const approved = (studentsData.students ?? []).filter((s: EnrichedStudentRequest) => s.status === 'approved')
        const byTutor = new Map<string, TutorGroup>()
        for (const s of approved as EnrichedStudentRequest[]) {
          const group = byTutor.get(s.tutorUserId) ?? { tutorUserId: s.tutorUserId, tutorName: s.tutorName, children: [] }
          group.children.push({ id: s.id, childName: s.childName })
          byTutor.set(s.tutorUserId, group)
        }
        setTutors([...byTutor.values()])
        setAllTutors(Array.isArray(tutorsData) ? tutorsData : [])
        const reviewed = new Set<string>(
          (requestsData.requests ?? [])
            .filter((r: { review: unknown }) => r.review)
            .map((r: { tutorUserId: string }) => r.tutorUserId),
        )
        setReviewedTutorIds(reviewed)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [refreshKey])

  const handleRemove = async (id: string) => {
    setRemovingId(id)
    setError('')
    const res = await fetch(`/api/parent/students/${id}`, { method: 'DELETE' })
    if (res.ok) {
      load()
      onRemoved?.()
    } else {
      setError('Failed to remove tutor.')
    }
    setRemovingId(null)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  if (tutors.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-400 text-sm">You don&rsquo;t have any approved tutors yet.</p>
      </div>
    )
  }

  const viewingFull = viewing ? allTutors.find(t => t.userId === viewing.tutorUserId) : null

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {tutors.map(t => {
          const full = allTutors.find(a => a.userId === t.tutorUserId)
          const hasReviewed = reviewedTutorIds.has(t.tutorUserId)
          return (
            <div key={t.tutorUserId} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition flex flex-col bg-white">
              <div className="relative h-16" style={{ background: getTutorGradient(t.tutorUserId) }}>
                <div className="absolute left-1/2 -bottom-8 -translate-x-1/2">
                  <Avatar name={t.tutorName} url={full?.photoUrl ?? ''} />
                </div>
              </div>

              <div className="pt-10 px-6 pb-6 flex flex-col flex-1 text-center">
                <p className="font-semibold text-gray-900">{t.tutorName}</p>
                <p className="text-sm text-gray-500 mb-1">{full?.instruments.join(', ')}</p>

                {full && (
                  <>
                    <p className="text-xs text-gray-400 mb-1">
                      {full.lessonsCompleted} lessons · {formatHours(full.hoursCompleted)} hrs
                    </p>
                    <div className="mb-1 flex justify-center">
                      <StarRating rating={full.rating} reviewCount={full.reviewCount} />
                    </div>
                  </>
                )}

                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {t.children.map(c => (
                    <span key={c.id} className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-full pl-2.5 pr-1.5 py-1">
                      {c.childName}
                      <button
                        type="button"
                        onClick={() => handleRemove(c.id)}
                        disabled={removingId === c.id}
                        className="text-gray-400 hover:text-red-500 transition leading-none disabled:opacity-50"
                        aria-label={`Remove ${t.tutorName} as ${c.childName}'s tutor`}
                        title="Remove this tutor"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="mt-auto pt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => setViewing(t)}
                    className="w-full bg-amber-600 text-white text-sm font-medium py-2 rounded-md hover:bg-amber-700 transition"
                  >
                    View tutor
                  </button>
                  {!hasReviewed && (
                    <button
                      type="button"
                      onClick={() => setReviewing(t)}
                      className="w-full text-sm text-gray-600 border border-gray-300 py-2 rounded-md hover:border-gray-500 transition"
                    >
                      Add a review
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {viewing && viewingFull && (
        <TutorDetailCard
          tutor={viewingFull}
          isParent
          isSignedIn
          childrenNames={viewing.children.map(c => c.childName)}
          onBook={t => { setViewing(null); setBooking({ tutorUserId: t.userId, tutorName: t.name, children: viewing.children }) }}
          onClose={() => setViewing(null)}
        />
      )}

      {booking && (
        <BookingModal
          tutorUserId={booking.tutorUserId}
          tutorName={booking.tutorName}
          onClose={() => setBooking(null)}
        />
      )}

      {reviewing && (
        <ReviewModal
          tutorUserId={reviewing.tutorUserId}
          tutorName={reviewing.tutorName}
          onClose={() => setReviewing(null)}
          onSubmitted={() => {
            setReviewedTutorIds(prev => new Set(prev).add(reviewing.tutorUserId))
            setReviewing(null)
          }}
        />
      )}
    </div>
  )
}
