'use client'

import { useState } from 'react'
import type { TutorProfileWithStats } from '@/lib/types'
import { toDisplayImageUrl } from '@/lib/images'
import { getTutorGradient } from '@/lib/gradient'
import { formatHours } from '@/lib/lessons'
import TutorAvailabilityPreview from './TutorAvailabilityPreview'
import TutorReviewsPreview from './TutorReviewsPreview'
import StarRating from '@/components/StarRating'

export function Avatar({ name, url, size = 'sm' }: { name: string; url: string; size?: 'sm' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const dim = size === 'lg' ? 'w-24 h-24' : 'w-16 h-16'
  const cls = `${dim} rounded-full object-cover bg-gray-100 ring-4 ring-white shadow-sm`
  const fallbackCls = `${dim} rounded-full bg-gray-100 flex items-center justify-center ${size === 'lg' ? 'text-2xl' : 'text-lg'} font-bold text-gray-500 ring-4 ring-white shadow-sm`

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

// A locked "See more" prompt in place of the schedule for anonymous visitors —
// qualifications/reviews stay public, only the schedule requires signing in.
function AvailabilityGate({ tutorName }: { tutorName: string }) {
  return (
    <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
      <p className="text-sm text-gray-500 mb-2">Sign in to see {tutorName}&apos;s availability.</p>
      <a
        href="/signin?redirect=/tutors"
        className="text-sm font-medium text-amber-700 hover:text-amber-800 underline"
      >
        See more
      </a>
    </div>
  )
}

interface Props {
  tutor: TutorProfileWithStats
  isParent?: boolean
  isSignedIn?: boolean
  onBook: (tutor: TutorProfileWithStats) => void
  onClose: () => void
  // Only passed from the parent dashboard's MyTutorsPanel — /tutors' grid has
  // no specific child in context, so this section is omitted there.
  childrenNames?: string[]
}

export default function TutorDetailCard({ tutor, isParent, isSignedIn, onBook, onClose, childrenNames }: Props) {
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
        {/* Gradient hero banner */}
        <div className="relative h-28" style={{ background: getTutorGradient(tutor.userId) }}>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-600 flex items-center justify-center text-xl leading-none transition"
            aria-label="Close"
          >
            ×
          </button>
          <div className="absolute left-1/2 -bottom-12 -translate-x-1/2">
            <Avatar name={tutor.name} url={tutor.photoUrl} size="lg" />
          </div>
        </div>

        {/* Hero text */}
        <div className="px-8 pt-16 pb-5 flex flex-col items-center text-center border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{tutor.name}</h2>
          {tutor.school && <p className="text-sm text-gray-500 mt-0.5">{tutor.school}</p>}
          {tutor.location && <p className="text-xs text-gray-400 mt-0.5">{tutor.location}</p>}
          <div className="mt-1.5"><StarRating rating={tutor.rating} reviewCount={tutor.reviewCount} /></div>

          <div className="flex gap-8 mt-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">{tutor.lessonsCompleted}</p>
              <p className="text-xs text-gray-400">lessons</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatHours(tutor.hoursCompleted)}</p>
              <p className="text-xs text-gray-400">hours</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5">
          {childrenNames && childrenNames.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Your student(s) with this tutor</p>
              <div className="flex flex-wrap gap-1.5">
                {childrenNames.map(name => (
                  <span key={name} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

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
            {isSignedIn ? (
              <TutorAvailabilityPreview tutorUserId={tutor.userId} />
            ) : (
              <AvailabilityGate tutorName={tutor.name} />
            )}
          </div>

          <TutorReviewsPreview tutorUserId={tutor.userId} />
        </div>

        {/* CTA */}
        <div className="px-8 pb-8">
          {isParent ? (
            <button
              type="button"
              onClick={() => { onClose(); onBook(tutor) }}
              className="w-full bg-amber-600 text-white text-sm font-medium py-3 rounded-xl hover:bg-amber-700 transition"
            >
              Request a lesson
            </button>
          ) : (
            <a
              href="/signin?redirect=/tutors"
              className="block w-full text-center bg-amber-600 text-white text-sm font-medium py-3 rounded-xl hover:bg-amber-700 transition"
            >
              Sign in to request a lesson
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
