'use client'

import { useState, useEffect } from 'react'
import type { LessonRequest } from '@/lib/types'

type EnrichedRequest = LessonRequest & { parentName: string; parentEmail: string }
import { formatTime } from '@/lib/schedule'

type Tab = 'new' | 'in_progress' | 'history'

const STATUS_LABELS: Record<LessonRequest['status'], string> = {
  pending: 'New',
  in_progress: 'In Progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<LessonRequest['status'], string> = {
  pending: 'bg-orange-100 text-orange-700',
  in_progress: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

interface Props {
  onPendingCountChange?: (count: number) => void
}

export default function LessonRequestsPanel({ onPendingCountChange }: Props) {
  const [requests, setRequests] = useState<EnrichedRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('new')
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    fetch('/api/tutor/requests')
      .then(r => r.json())
      .then(d => {
        setRequests(d.requests ?? [])
        onPendingCountChange?.(d.pendingCount ?? 0)
      })
      .catch(() => setError('Failed to load requests.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: LessonRequest['status']) => {
    setUpdating(id)
    setError('')
    const res = await fetch(`/api/lessons/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      onPendingCountChange?.(requests.filter(r => r.id !== id && r.status === 'pending').length)
    } else {
      setError('Failed to update. Try again.')
    }
    setUpdating(null)
  }

  const filtered = requests.filter(r => {
    if (tab === 'new') return r.status === 'pending'
    if (tab === 'in_progress') return r.status === 'in_progress'
    return r.status === 'complete' || r.status === 'cancelled'
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const inProgressCount = requests.filter(r => r.status === 'in_progress').length

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-full transition ${
      tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
    }`

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setTab('new')} className={tabCls('new')}>
          New {pendingCount > 0 && <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>}
        </button>
        <button onClick={() => setTab('in_progress')} className={tabCls('in_progress')}>
          In Progress {inProgressCount > 0 && <span className="ml-1 text-xs text-blue-600">({inProgressCount})</span>}
        </button>
        <button onClick={() => setTab('history')} className={tabCls('history')}>
          History
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">
            {tab === 'new' ? 'No new requests.' : tab === 'in_progress' ? 'No requests in progress.' : 'No history yet.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(req => (
          <div key={req.id} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{req.childName}</p>
                <p className="text-xs text-gray-500">Parent: {req.parentName} · <a href={`mailto:${req.parentEmail}`} className="underline hover:text-gray-700">{req.parentEmail}</a></p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[req.status]}`}>
                {STATUS_LABELS[req.status]}
              </span>
            </div>

            <p className="text-sm text-gray-700 mb-1">
              {formatDate(req.requestedDate)} · {formatTime(req.requestedStartTime)}–{formatTime(req.requestedEndTime)} EST
            </p>

            {req.message && (
              <p className="text-sm text-gray-500 italic border-l-2 border-gray-200 pl-3 my-2">
                "{req.message}"
              </p>
            )}

            {req.status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => updateStatus(req.id, 'in_progress')}
                  disabled={updating === req.id}
                  className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Start conversation
                </button>
              </div>
            )}

            {req.status === 'in_progress' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => updateStatus(req.id, 'complete')}
                  disabled={updating === req.id}
                  className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition disabled:opacity-50"
                >
                  Mark complete
                </button>
                <button
                  onClick={() => updateStatus(req.id, 'cancelled')}
                  disabled={updating === req.id}
                  className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-md hover:border-gray-500 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
