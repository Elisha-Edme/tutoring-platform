'use client'

import { useState, useEffect } from 'react'
import type { TutorProfileWithStats } from '@/lib/types'
import BookingModal from '@/app/tutors/BookingModal'
import TutorDetailCard from '@/app/tutors/TutorDetailCard'

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
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<TutorGroup | null>(null)
  const [viewing, setViewing] = useState<TutorGroup | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    Promise.all([
      fetch('/api/parent/students').then(r => r.json()),
      fetch('/api/tutors').then(r => (r.ok ? r.json() : [])),
    ])
      .then(([studentsData, tutorsData]) => {
        const approved = (studentsData.students ?? []).filter((s: EnrichedStudentRequest) => s.status === 'approved')
        const byTutor = new Map<string, TutorGroup>()
        for (const s of approved as EnrichedStudentRequest[]) {
          const group = byTutor.get(s.tutorUserId) ?? { tutorUserId: s.tutorUserId, tutorName: s.tutorName, children: [] }
          group.children.push({ id: s.id, childName: s.childName })
          byTutor.set(s.tutorUserId, group)
        }
        setTutors([...byTutor.values()])
        setAllTutors(Array.isArray(tutorsData) ? tutorsData : [])
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
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {tutors.map(t => (
        <div
          key={t.tutorUserId}
          className="border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-400 transition"
          onClick={() => setViewing(t)}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-gray-900 text-sm">{t.tutorName}</p>
            <button
              onClick={e => { e.stopPropagation(); setBooking(t) }}
              className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition shrink-0"
            >
              Book a lesson
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {t.children.map(c => (
              <span key={c.id} className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-full pl-2.5 pr-1.5 py-1">
                {c.childName}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); handleRemove(c.id) }}
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
        </div>
      ))}

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
    </div>
  )
}
