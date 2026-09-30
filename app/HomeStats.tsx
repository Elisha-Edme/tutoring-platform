'use client'

import { useState, useEffect } from 'react'
import { HISTORICAL_LESSONS, HISTORICAL_HOURS } from '@/lib/constants'

type Totals = { lessons: number; hours: number }

// The live totals come from /api/stats (the page can't read Sheets during
// render), so until they arrive we show a spinner rather than the historical
// baseline — that would flash a too-low number. If the fetch fails we show the
// baseline with a "+": a true lower bound, better than a blank.
export default function HomeStats() {
  const [totals, setTotals] = useState<Totals | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setTotals({ lessons: d.lessons, hours: d.hours }))
      .catch(() => setFailed(true))
  }, [])

  const format = (live: number | undefined, baseline: number) =>
    failed ? `${baseline.toLocaleString()}+` : live?.toLocaleString()

  const stats = [
    { value: format(totals?.lessons, HISTORICAL_LESSONS), label: 'lessons taught' },
    { value: format(totals?.hours, HISTORICAL_HOURS), label: 'hours completed' },
    { value: '35', label: 'volunteer tutors' },
  ]

  return (
    <section className="border-y border-gray-100 bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-12 flex justify-center gap-12 sm:gap-20">
        {stats.map(s => (
          <div key={s.label} className="text-center">
            {s.value === undefined ? (
              <div className="h-10 flex items-center justify-center" role="status" aria-label="Loading">
                <svg className="h-7 w-7 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            ) : (
              <p className="text-4xl font-bold text-gray-900">{s.value}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
