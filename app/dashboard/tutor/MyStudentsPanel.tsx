'use client'

import { useState, useEffect } from 'react'
import type { Child } from '@/lib/types'

interface EnrichedStudent {
  tutorUserId: string
  parentUserId: string
  parentName: string
  childName: string
  addedAt: string
}

interface LookupResult {
  parentUserId: string
  name: string
  children: Child[]
}

export default function MyStudentsPanel() {
  const [students, setStudents] = useState<EnrichedStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Add-student flow state
  const [showAdd, setShowAdd] = useState(false)
  const [searchEmail, setSearchEmail] = useState('')
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [selectedChild, setSelectedChild] = useState('')
  const [adding, setAdding] = useState(false)

  const load = () => {
    fetch('/api/tutor/students')
      .then(r => r.json())
      .then(d => setStudents(d.students ?? []))
      .catch(() => setError('Failed to load students.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleLookup = async () => {
    if (!searchEmail.trim()) return
    setLookupLoading(true)
    setLookupError('')
    setLookupResult(null)
    setSelectedChild('')
    const res = await fetch(`/api/parent/by-email?email=${encodeURIComponent(searchEmail.trim())}`)
    if (res.ok) {
      setLookupResult(await res.json())
    } else {
      const d = await res.json().catch(() => ({}))
      setLookupError(d.error ?? 'Not found.')
    }
    setLookupLoading(false)
  }

  const handleAdd = async () => {
    if (!lookupResult || !selectedChild) return
    setAdding(true)
    const res = await fetch('/api/tutor/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentUserId: lookupResult.parentUserId, childName: selectedChild }),
    })
    if (res.ok) {
      setShowAdd(false)
      setSearchEmail('')
      setLookupResult(null)
      setSelectedChild('')
      setLoading(true)
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      setLookupError(d.error ?? 'Failed to add student.')
    }
    setAdding(false)
  }

  const handleRemove = async (parentUserId: string, childName: string) => {
    const res = await fetch('/api/tutor/students', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentUserId, childName }),
    })
    if (res.ok) setStudents(prev => prev.filter(s => !(s.parentUserId === parentUserId && s.childName === childName)))
    else setError('Failed to remove student.')
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {students.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400 mb-3">No students yet.</p>
      )}

      {students.length > 0 && (
        <div className="space-y-2 mb-4">
          {students.map(s => (
            <div key={`${s.parentUserId}-${s.childName}`} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{s.childName}</p>
                <p className="text-xs text-gray-500">Parent: {s.parentName}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(s.parentUserId, s.childName)}
                className="text-gray-400 hover:text-red-500 transition text-lg leading-none"
                aria-label="Remove student"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {!showAdd && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          + Add a student
        </button>
      )}

      {showAdd && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Find a parent by email</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder="parent@example.com"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              onClick={handleLookup}
              disabled={lookupLoading}
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
            >
              {lookupLoading ? '…' : 'Look up'}
            </button>
          </div>

          {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}

          {lookupResult && (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Found: <strong>{lookupResult.name}</strong> · {lookupResult.children.length} child(ren)
              </p>
              {lookupResult.children.length === 0 ? (
                <p className="text-sm text-gray-400">This parent has no children registered yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {lookupResult.children.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedChild(c.name)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${
                        selectedChild === c.name
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'border-gray-300 text-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {c.name} · {c.grade}
                    </button>
                  ))}
                </div>
              )}

              {selectedChild && (
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    {adding ? 'Adding…' : `Add ${selectedChild}`}
                  </button>
                  <button
                    onClick={() => { setShowAdd(false); setLookupResult(null); setSearchEmail('') }}
                    disabled={adding}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {!lookupResult && (
            <button
              onClick={() => setShowAdd(false)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
