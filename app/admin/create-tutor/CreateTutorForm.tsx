'use client'

import { useState } from 'react'

const INSTRUMENTS = ['Violin', 'Viola', 'Cello', 'Trumpet', 'Drums', 'Flute', 'Alto Saxophone', 'Tuba', 'Trombone']

interface SeedResult {
  name: string
  status: 'created' | 'skipped'
}

export default function CreateTutorForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [school, setSchool] = useState('')
  const [credentials, setCredentials] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const [seedStatus, setSeedStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [seedResults, setSeedResults] = useState<SeedResult[]>([])

  const toggleInstrument = (inst: string) => {
    setSelectedInstruments(prev =>
      prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]
    )
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (selectedInstruments.length === 0) {
      setStatus('error')
      setErrorMsg('Select at least one instrument.')
      return
    }
    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/admin/create-tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, instruments: selectedInstruments, bio, school, credentials, location }),
    })

    const data = await res.json()
    if (res.ok) {
      setStatus('success')
      setName(''); setEmail(''); setSelectedInstruments([]); setBio(''); setSchool(''); setCredentials(''); setLocation('')
    } else {
      setStatus('error')
      setErrorMsg(data.error ?? 'Something went wrong.')
    }
  }

  const handleSeed = async () => {
    setSeedStatus('loading')
    const res = await fetch('/api/admin/seed-tutors', { method: 'POST' })
    const data = await res.json()
    setSeedResults(data.results ?? [])
    setSeedStatus('done')
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin — Tutor Management</h1>
      <p className="text-gray-500 mb-10 text-sm">This page is not publicly linked.</p>

      <section className="border border-gray-200 rounded-xl p-6 mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Seed all 10 Tune Up Together tutors</h2>
        <p className="text-sm text-gray-500 mb-4">
          Populates Google Sheets with all 10 known tutors in one click. Skips any already added.
        </p>
        <button onClick={handleSeed} disabled={seedStatus === 'loading'}
          className="bg-gray-900 text-white px-5 py-2 rounded-md text-sm hover:bg-gray-700 transition disabled:opacity-50">
          {seedStatus === 'loading' ? 'Seeding...' : 'Seed tutors'}
        </button>

        {seedStatus === 'done' && seedResults.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {seedResults.map(r => (
              <li key={r.name} className={r.status === 'created' ? 'text-green-600' : 'text-gray-400'}>
                {r.status === 'created' ? '✓' : '–'} {r.name} ({r.status})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Add a single tutor</h2>

        {status === 'success' && <p className="text-green-600 text-sm mb-4">Tutor created successfully.</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="Navin Vasudev"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tutor@example.com"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Instruments</label>
            <div className="flex flex-wrap gap-2">
              {INSTRUMENTS.map(inst => (
                <button key={inst} type="button" onClick={() => toggleInstrument(inst)}
                  className={`px-3 py-1 rounded-full text-sm border transition ${
                    selectedInstruments.includes(inst)
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}>
                  {inst}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credentials</label>
            <input type="text" value={credentials} onChange={e => setCredentials(e.target.value)}
              placeholder="8 years playing, NYSSMA Level 5"
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
              <input type="text" value={school} onChange={e => setSchool(e.target.value)}
                placeholder="Local High School"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="Greater New York Area"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
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
            {status === 'loading' ? 'Creating...' : 'Create tutor'}
          </button>
        </form>
      </section>
    </div>
  )
}
