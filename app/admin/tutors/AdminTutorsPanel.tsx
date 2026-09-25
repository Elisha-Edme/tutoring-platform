'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { TutorProfileWithStats } from '@/lib/types'
import { TUTOR_INSTRUMENTS } from '@/lib/constants'
import { getTutorGradient } from '@/lib/gradient'
import { formatHours } from '@/lib/lessons'
import { Avatar } from '@/app/tutors/TutorDetailCard'
import StarRating from '@/components/StarRating'

const INSTRUMENTS = ['All', ...TUTOR_INSTRUMENTS]

export default function AdminTutorsPanel() {
  const [tutors, setTutors] = useState<TutorProfileWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/admin/tutors')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => setTutors(Array.isArray(data) ? data : []))
      .catch(() => setHasError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400 text-sm">Loading tutors…</p>
  if (hasError) return <p className="text-gray-400 text-sm">Couldn&apos;t load tutors. Please refresh.</p>
  if (tutors.length === 0) return <p className="text-gray-400 text-sm">No tutors yet.</p>

  const q = query.trim().toLowerCase()
  const visible = tutors.filter(t => {
    const matchesInstrument = filter === 'All' || t.instruments.includes(filter)
    const matchesQuery = !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
    return matchesInstrument && matchesQuery
  })

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search tutors by name or email…"
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
            <Link
              key={tutor.userId}
              href={`/admin/tutors/${tutor.userId}`}
              className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition flex flex-col bg-white"
            >
              <div className="relative h-16" style={{ background: getTutorGradient(tutor.userId) }}>
                <div className="absolute left-1/2 -bottom-8 -translate-x-1/2">
                  <Avatar name={tutor.name} url={tutor.photoUrl} />
                </div>
              </div>

              <div className="pt-10 px-6 pb-6 flex flex-col flex-1 text-center">
                <p className="font-semibold text-gray-900">{tutor.name}</p>
                <p className="text-xs text-gray-400 mb-1">{tutor.email}</p>
                <p className="text-sm text-gray-500 mb-1">{tutor.instruments.join(', ')}</p>

                <p className="text-xs text-gray-400 mb-1">
                  {tutor.lessonsCompleted} lessons · {formatHours(tutor.hoursCompleted)} hrs
                </p>

                <div className="mb-1 flex justify-center">
                  <StarRating rating={tutor.rating} reviewCount={tutor.reviewCount} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
