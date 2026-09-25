'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ParentProfile } from '@/lib/types'

export default function AdminParentsPanel() {
  const [parents, setParents] = useState<ParentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/admin/parents')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => setParents(Array.isArray(data) ? data : []))
      .catch(() => setHasError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400 text-sm">Loading parents…</p>
  if (hasError) return <p className="text-gray-400 text-sm">Couldn&apos;t load parents. Please refresh.</p>
  if (parents.length === 0) return <p className="text-gray-400 text-sm">No parents yet.</p>

  const q = query.trim().toLowerCase()
  const visible = parents.filter(p => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search parents by name or email…"
        className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      {visible.length === 0 ? (
        <p className="text-gray-400 text-sm">No parents found. Try a different search.</p>
      ) : (
        <div className="space-y-2">
          {visible.map(p => (
            <Link
              key={p.userId}
              href={`/admin/parents/${p.userId}`}
              className="block border border-gray-100 rounded-lg px-4 py-3 hover:border-gray-300 transition"
            >
              <p className="text-sm font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-500">{p.email}</p>
              {p.children.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {p.children.map(c => c.name).join(', ')}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
