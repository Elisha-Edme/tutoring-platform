'use client'

import { useState } from 'react'
import type { TutorProfile } from '@/lib/types'

const INSTRUMENTS = ['All', 'Violin', 'Viola', 'Cello', 'Trumpet', 'Drums', 'Flute', 'Alto Saxophone']

export default function TutorGrid({ tutors }: { tutors: TutorProfile[] }) {
  const [filter, setFilter] = useState('All')

  const visible = filter === 'All'
    ? tutors
    : tutors.filter(t => t.instruments.includes(filter))

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-8">
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

      {visible.length === 0 ? (
        <p className="text-gray-400 text-sm">No tutors found for this instrument.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {visible.map(tutor => (
            <div
              key={tutor.userId}
              className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-500 mb-4">
                {tutor.name[0]}
              </div>
              <p className="font-semibold text-gray-900">{tutor.name}</p>
              <p className="text-sm text-gray-500 mb-1">{tutor.instruments.join(', ')}</p>
              {tutor.credentials && (
                <p className="text-xs text-gray-400 mt-2">{tutor.credentials}</p>
              )}
              {tutor.bio && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{tutor.bio}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
