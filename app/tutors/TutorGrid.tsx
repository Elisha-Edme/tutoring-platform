'use client'

import { useState, useEffect } from 'react'
import type { TutorProfile } from '@/lib/types'
import { toDisplayImageUrl } from '@/lib/images'
import { TUTOR_INSTRUMENTS } from '@/lib/constants'
import BookingModal from './BookingModal'
import TutorAvailabilityPreview from './TutorAvailabilityPreview'

const INSTRUMENTS = ['All', ...TUTOR_INSTRUMENTS]

function Avatar({ name, url, size = 'sm' }: { name: string; url: string; size?: 'sm' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const cls = size === 'lg'
    ? 'w-20 h-20 rounded-full object-cover bg-gray-100'
    : 'w-12 h-12 rounded-full object-cover bg-gray-100 mb-4'
  const fallbackCls = size === 'lg'
    ? 'w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-500'
    : 'w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-500 mb-4'

  if (!url || failed) {
    return <div className={fallbackCls}>{name[0]}</div>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={toDisplayImageUrl(url)}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cls}
    />
  )
}

function StarRating({ rating }: { rating: number }) {
  if (!rating) return null
  const full = Math.round(rating)
  return (
    <span className="text-xs text-gray-500">
      {'★'.repeat(Math.min(full, 5))}{'☆'.repeat(Math.max(0, 5 - full))} {rating.toFixed(1)}
    </span>
  )
}

interface TutorCardProps {
  tutor: TutorProfile
  isParent?: boolean
  onBook: (tutor: TutorProfile) => void
}

function TutorModal({ tutor, isParent, onBook, onClose }: TutorCardProps & { onClose: () => void }) {
  // Close on backdrop click
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl leading-none z-10"
          aria-label="Close"
        >
          ×
        </button>

        {/* Hero */}
        <div className="px-8 pt-8 pb-5 flex flex-col items-center text-center border-b border-gray-100">
          <Avatar name={tutor.name} url={tutor.photoUrl} size="lg" />
          <h2 className="mt-3 text-xl font-bold text-gray-900">{tutor.name}</h2>
          {tutor.school && <p className="text-sm text-gray-500 mt-0.5">{tutor.school}</p>}
          {tutor.location && <p className="text-xs text-gray-400 mt-0.5">{tutor.location}</p>}
          {tutor.rating > 0 && <div className="mt-1.5"><StarRating rating={tutor.rating} /></div>}

          {(tutor.lessonsCompleted > 0 || tutor.hoursCompleted > 0) && (
            <div className="flex gap-8 mt-4">
              {tutor.lessonsCompleted > 0 && (
                <div>
                  <p className="text-2xl font-bold text-gray-900">{tutor.lessonsCompleted}</p>
                  <p className="text-xs text-gray-400">lessons</p>
                </div>
              )}
              {tutor.hoursCompleted > 0 && (
                <div>
                  <p className="text-2xl font-bold text-gray-900">{tutor.hoursCompleted}</p>
                  <p className="text-xs text-gray-400">hours</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5">
          {tutor.bio && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">About</p>
              <p className="text-sm text-gray-700 leading-relaxed">{tutor.bio}</p>
            </div>
          )}

          {tutor.credentials && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Credentials</p>
              <p className="text-sm text-gray-700">{tutor.credentials}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Teaches</p>
            <div className="flex flex-wrap gap-1.5">
              {tutor.instruments.map(inst => (
                <span key={inst} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                  {inst}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Availability</p>
            <TutorAvailabilityPreview tutorUserId={tutor.userId} />
          </div>
        </div>

        {/* CTA */}
        <div className="px-8 pb-8">
          {isParent ? (
            <button
              type="button"
              onClick={() => { onClose(); onBook(tutor) }}
              className="w-full bg-gray-900 text-white text-sm font-medium py-3 rounded-xl hover:bg-gray-700 transition"
            >
              Request a lesson
            </button>
          ) : (
            <a
              href="/signin?redirect=/tutors"
              className="block w-full text-center bg-gray-900 text-white text-sm font-medium py-3 rounded-xl hover:bg-gray-700 transition"
            >
              Sign in to request a lesson
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function TutorCard({ tutor, isParent, onBook }: TutorCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition flex flex-col">
        <Avatar name={tutor.name} url={tutor.photoUrl} />
        <p className="font-semibold text-gray-900">{tutor.name}</p>
        <p className="text-sm text-gray-500 mb-1">{tutor.instruments.join(', ')}</p>

        {(tutor.lessonsCompleted > 0 || tutor.hoursCompleted > 0) && (
          <p className="text-xs text-gray-400 mb-1">
            {tutor.lessonsCompleted > 0 && `${tutor.lessonsCompleted} lessons`}
            {tutor.lessonsCompleted > 0 && tutor.hoursCompleted > 0 && ' · '}
            {tutor.hoursCompleted > 0 && `${tutor.hoursCompleted} hrs`}
          </p>
        )}

        {tutor.rating > 0 && (
          <div className="mb-1"><StarRating rating={tutor.rating} /></div>
        )}

        {tutor.bio && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{tutor.bio}</p>
        )}

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full border border-gray-300 text-gray-600 text-sm py-2 rounded-md hover:border-gray-500 hover:text-gray-800 transition"
          >
            View tutor
          </button>
        </div>
      </div>

      {open && (
        <TutorModal
          tutor={tutor}
          isParent={isParent}
          onBook={onBook}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default function TutorGrid({ isParent }: { isParent?: boolean }) {
  const [tutors, setTutors] = useState<TutorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [bookingTutor, setBookingTutor] = useState<TutorProfile | null>(null)

  useEffect(() => {
    fetch('/api/tutors')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => setTutors(Array.isArray(data) ? data : []))
      .catch(() => setHasError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400 text-sm">Loading tutors…</p>
  if (hasError) return <p className="text-gray-400 text-sm">Couldn&apos;t load tutors. Please refresh.</p>
  if (tutors.length === 0) {
    return <p className="text-gray-400 text-sm">No tutors yet. Use the admin panel to seed tutors.</p>
  }

  const q = query.trim().toLowerCase()
  const visible = tutors.filter(t => {
    const matchesInstrument = filter === 'All' || t.instruments.includes(filter)
    const matchesQuery = !q || t.name.toLowerCase().includes(q)
    return matchesInstrument && matchesQuery
  })

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search tutors by name…"
        className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      <div className="flex gap-2 flex-wrap mb-4">
        {INSTRUMENTS.map(inst => (
          <button
            key={inst}
            onClick={() => setFilter(inst)}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              filter === inst
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 text-gray-600 hover:border-gray-500'
            }`}
          >
            {inst}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-8">
        Showing {visible.length} {visible.length === 1 ? 'tutor' : 'tutors'}
      </p>

      {visible.length === 0 ? (
        <p className="text-gray-400 text-sm">No tutors found. Try a different search or filter.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {visible.map(tutor => (
            <TutorCard
              key={tutor.userId}
              tutor={tutor}
              isParent={isParent}
              onBook={setBookingTutor}
            />
          ))}
        </div>
      )}

      {bookingTutor && (
        <BookingModal
          tutorUserId={bookingTutor.userId}
          tutorName={bookingTutor.name}
          onClose={() => setBookingTutor(null)}
        />
      )}
    </div>
  )
}
