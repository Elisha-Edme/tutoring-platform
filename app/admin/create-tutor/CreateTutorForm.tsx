'use client'

import { useState, useEffect } from 'react'
import type { TutorInvite } from '@/lib/types'

export default function CreateTutorForm() {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [inviteError, setInviteError] = useState('')
  const [invites, setInvites] = useState<TutorInvite[]>([])
  const [loadingInvites, setLoadingInvites] = useState(true)
  const [invitesError, setInvitesError] = useState('')

  const loadInvites = () => {
    return fetch('/api/admin/tutor-invites')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { setInvites(d.invites ?? []); setInvitesError('') })
      .catch(() => setInvitesError('Failed to load invites.'))
      .finally(() => setLoadingInvites(false))
  }

  useEffect(() => { loadInvites() }, [])

  const handleInvite = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setInviteStatus('loading')
    setInviteError('')

    const res = await fetch('/api/admin/tutor-invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })

    const data = await res.json()
    if (res.ok) {
      setInviteStatus('success')
      setInviteEmail('')
      await loadInvites()
    } else {
      setInviteStatus('error')
      setInviteError(data.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin — Tutor Management</h1>
      <p className="text-gray-500 mb-10 text-sm">This page is not publicly linked.</p>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Invite a tutor</h2>
        <p className="text-sm text-gray-500 mb-6">
          They&rsquo;ll get an email with a link to set up their own profile and password.
        </p>

        {inviteStatus === 'success' && <p className="text-green-600 text-sm mb-4">Invite sent.</p>}

        <form onSubmit={handleInvite} className="flex gap-2 mb-4">
          <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="tutor@example.com"
            className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <button type="submit" disabled={inviteStatus === 'loading'}
            className="bg-gray-900 text-white px-5 py-2 rounded-md text-sm hover:bg-gray-700 transition disabled:opacity-50 shrink-0">
            {inviteStatus === 'loading' ? 'Sending...' : 'Send invite'}
          </button>
        </form>

        {inviteStatus === 'error' && <p className="text-sm text-red-600 mb-4">{inviteError}</p>}

        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Invites sent</h3>
        {loadingInvites ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : invitesError ? (
          <p className="text-sm text-red-600">{invitesError}</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-gray-400">No invites sent yet.</p>
        ) : (
          <div className="space-y-2">
            {invites.map(inv => (
              <div key={inv.token} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-4 py-2.5">
                <div>
                  <p className="text-sm text-gray-900">{inv.email}</p>
                  <p className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                  inv.usedAt ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {inv.usedAt ? 'Signed up' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
