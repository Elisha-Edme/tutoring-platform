'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { INSTRUMENTS } from '@/lib/constants'

type InviteState = 'checking' | 'valid' | 'invalid'

export default function TutorSignUpForm({ token }: { token: string }) {
  const router = useRouter()
  const [inviteState, setInviteState] = useState<InviteState>(token ? 'checking' : 'invalid')
  const [inviteError, setInviteError] = useState('This invite link is invalid or missing.')
  const [email, setEmail] = useState('')

  const [name, setName] = useState('')
  const [instruments, setInstruments] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [credentials, setCredentials] = useState('')
  const [location, setLocation] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`/api/tutor-invites/${token}`)
      .then(async r => {
        const data = await r.json()
        if (r.ok) {
          setEmail(data.email)
          setInviteState('valid')
        } else {
          setInviteError(data.error ?? 'This invite link is invalid or has already been used.')
          setInviteState('invalid')
        }
      })
      .catch(() => {
        setInviteError('Failed to check this invite link. Please try again.')
        setInviteState('invalid')
      })
  }, [token])

  const toggleInstrument = (inst: string) => {
    setInstruments(prev => prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst])
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setStatus('error')
      setErrorMsg('Passwords do not match.')
      return
    }
    if (instruments.length === 0) {
      setStatus('error')
      setErrorMsg('Select at least one instrument.')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/auth/tutor-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, instruments, bio, credentials, location, password }),
    })

    const data = await res.json()
    if (res.ok) {
      router.push('/dashboard/tutor')
      router.refresh()
    } else {
      setStatus('error')
      setErrorMsg(data.error ?? 'Something went wrong.')
    }
  }

  if (inviteState === 'checking') {
    return <p className="text-center text-sm text-gray-400 py-24">Checking your invite…</p>
  }

  if (inviteState === 'invalid') {
    return <p className="text-center text-sm text-red-600 py-24">{inviteError}</p>
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete your signup</h1>
      <p className="text-gray-500 mb-8">You&rsquo;re joining Tune Up Together as a tutor.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input type="email" disabled value={email}
              className="w-full border border-gray-200 bg-gray-50 rounded-md px-4 py-2 text-sm text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Same password again"
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
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

        {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}

        <button type="submit" disabled={status === 'loading'}
          className="w-full bg-gray-900 text-white py-3 rounded-md text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">
          {status === 'loading' ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
