'use client'

import { useState, useEffect } from 'react'
import type { Child } from '@/lib/types'
import { GRADES, CHILD_INSTRUMENTS } from '@/lib/constants'

const emptyChild = (): Child => ({ name: '', grade: '', instruments: [] })

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export default function ManageChildren() {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Which child is being edited. null = none. Equal to children.length = adding a new one.
  const [draftIndex, setDraftIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<Child | null>(null)

  useEffect(() => {
    fetch('/api/parent/children')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => setChildren(Array.isArray(data.children) ? data.children : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const startEdit = (i: number) => {
    setDraft({ ...children[i], instruments: [...children[i].instruments] })
    setDraftIndex(i)
    setError('')
  }

  const startAdd = () => {
    setDraft(emptyChild())
    setDraftIndex(children.length)
    setError('')
  }

  const cancel = () => {
    setDraft(null)
    setDraftIndex(null)
    setError('')
  }

  const updateDraft = (field: 'name' | 'grade', value: string) =>
    setDraft(prev => (prev ? { ...prev, [field]: value } : prev))

  const toggleInstrument = (inst: string) =>
    setDraft(prev => {
      if (!prev) return prev
      const has = prev.instruments.includes(inst)
      return { ...prev, instruments: has ? prev.instruments.filter(x => x !== inst) : [...prev.instruments, inst] }
    })

  // Persist a new full children array via the replace-all PUT.
  const persist = async (next: Child[]) => {
    setSaving(true)
    setError('')
    const res = await fetch('/api/parent/children', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ children: next }),
    })
    if (res.ok) {
      const data = await res.json()
      setChildren(data.children)
      cancel()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong.')
    }
    setSaving(false)
  }

  const saveDraft = () => {
    if (!draft || draftIndex === null) return
    if (!draft.name.trim() || !draft.grade || draft.instruments.length === 0) {
      setError('Please add a name, a grade, and at least one instrument.')
      return
    }
    const next = [...children]
    if (draftIndex >= children.length) next.push(draft)
    else next[draftIndex] = draft
    persist(next)
  }

  const removeChild = (i: number) => {
    persist(children.filter((_, idx) => idx !== i))
  }

  if (loading) return <p className="text-gray-400 text-sm mb-10">Loading your children…</p>

  const editForm = (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <input
        type="text" placeholder="Child's name" value={draft?.name ?? ''}
        onChange={e => updateDraft('name', e.target.value)}
        className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      <select
        value={draft?.grade ?? ''} onChange={e => updateDraft('grade', e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      >
        <option value="">Grade...</option>
        {GRADES.map(g => <option key={g}>{g}</option>)}
      </select>
      <div>
        <p className="text-xs text-gray-500 mb-2">Instrument(s) — select all that apply</p>
        <div className="flex flex-wrap gap-2">
          {CHILD_INSTRUMENTS.map(inst => {
            const selected = draft?.instruments.includes(inst)
            return (
              <button
                key={inst} type="button" onClick={() => toggleInstrument(inst)}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  selected
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-300 text-gray-600 hover:border-gray-500'
                }`}
              >
                {inst}
              </button>
            )
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={saveDraft} disabled={saving}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={cancel} disabled={saving} className="text-sm text-gray-600 hover:text-gray-900 px-2 py-2">
          Cancel
        </button>
        {draftIndex !== null && draftIndex < children.length && (
          <button
            onClick={() => removeChild(draftIndex)} disabled={saving}
            className="text-sm text-red-500 hover:text-red-700 ml-auto"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Your children</h2>
        <button
          onClick={startAdd}
          disabled={draftIndex !== null}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
        >
          <PlusIcon /> Add child
        </button>
      </div>

      {children.length === 0 && draftIndex === null && (
        <p className="text-gray-400 text-sm">No children added yet.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children.map((child, i) => (
          draftIndex === i ? (
            <div key={i}>{editForm}</div>
          ) : (
            <div key={i} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{child.name}</p>
                <p className="text-sm text-gray-500">{child.grade} grade · {child.instruments.join(', ')}</p>
              </div>
              <button
                onClick={() => startEdit(i)}
                disabled={draftIndex !== null}
                aria-label={`Edit ${child.name}`}
                className="text-gray-400 hover:text-gray-900 transition disabled:opacity-40"
              >
                <PencilIcon />
              </button>
            </div>
          )
        ))}

        {draftIndex === children.length && <div>{editForm}</div>}
      </div>
    </section>
  )
}
