'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { TutorInvite } from '@/lib/types'
import { INSTRUMENTS } from '@/lib/constants'

type Mode = 'invite' | 'create'

export default function CreateTutorForm() {
  const [mode, setMode] = useState<Mode>('invite')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [inviteError, setInviteError] = useState('')
  const [invites, setInvites] = useState<TutorInvite[]>([])
  const [loadingInvites, setLoadingInvites] = useState(true)
  const [invitesError, setInvitesError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [instruments, setInstruments] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [credentials, setCredentials] = useState('')
  const [school, setSchool] = useState('')
  const [location, setLocation] = useState('')
  const [createStatus, setCreateStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [createError, setCreateError] = useState('')
  const [createdTutorId, setCreatedTutorId] = useState('')

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

  const toggleInstrument = (inst: string) => {
    setInstruments(prev => prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst])
  }

  const handleCreate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (instruments.length === 0) {
      setCreateStatus('error')
      setCreateError('Select at least one instrument.')
      return
    }
    setCreateStatus('loading')
    setCreateError('')
    setCreatedTutorId('')

    const res = await fetch('/api/admin/tutors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, instruments, bio, credentials, school, location }),
    })

    const data = await res.json()
    if (res.ok) {
      setCreateStatus('idle')
      setCreatedTutorId(data.tutorUserId)
      setName(''); setEmail(''); setInstruments([]); setBio(''); setCredentials(''); setSchool(''); setLocation('')
    } else {
      setCreateStatus('error')
      setCreateError(data.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin — Tutor Management</h1>
      <p className="text-gray-500 mb-6 text-sm">This page is not publicly linked.</p>

      <div className="flex gap-2 mb-8">
        <button
          type="button"
          onClick={() => setMode('invite')}
          className={`px-4 py-2 text-sm font-medium rounded-full transition ${
            mode === 'invite' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Invite by email
        </button>
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`px-4 py-2 text-sm font-medium rounded-full transition ${
            mode === 'create' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Create now with full profile
        </button>
      </div>

      {mode === 'invite' ? (
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
      ) : (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Create a tutor now</h2>
          <p className="text-sm text-gray-500 mb-6">
            Creates the account immediately with the shared default password (<code>TuneUp123</code>) —
            no email or signup step required. Share the password with them directly.
          </p>

          {createdTutorId && (
            <p className="text-green-600 text-sm mb-4">
              Tutor created.{' '}
              <Link href={`/admin/tutors/${createdTutorId}`} className="underline">View profile</Link>
            </p>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tutor@example.com"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Instruments — select all that apply</p>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENTS.map(inst => {
                  const selected = instruments.includes(inst)
                  return (
                    <button
                      key={inst}
                      type="button"
                      onClick={() => toggleInstrument(inst)}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credentials</label>
              <input type="text" value={credentials} onChange={e => setCredentials(e.target.value)}
                placeholder="8 years playing, NYSSMA Level 5"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
              <input type="text" value={school} onChange={e => setSchool(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="City, State"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                placeholder="A short bio..."
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>

            {createStatus === 'error' && <p className="text-sm text-red-600">{createError}</p>}

            <button type="submit" disabled={createStatus === 'loading'}
              className="w-full bg-gray-900 text-white py-3 rounded-md text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">
              {createStatus === 'loading' ? 'Creating…' : 'Create tutor'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
