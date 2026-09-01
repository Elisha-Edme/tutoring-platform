'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GRADES, CHILD_INSTRUMENTS } from '@/lib/constants'

interface Child {
  name: string
  grade: string
  instruments: string[]
}

export default function SignUpForm() {
  const router = useRouter()
  const [parentName, setParentName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [children, setChildren] = useState<Child[]>([{ name: '', grade: '', instruments: [] }])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const updateChild = (index: number, field: 'name' | 'grade', value: string) => {
    setChildren(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const toggleInstrument = (index: number, inst: string) => {
    setChildren(prev => prev.map((c, i) => {
      if (i !== index) return c
      const has = c.instruments.includes(inst)
      return { ...c, instruments: has ? c.instruments.filter(x => x !== inst) : [...c.instruments, inst] }
    }))
  }

  const addChild = () => setChildren(prev => [...prev, { name: '', grade: '', instruments: [] }])
  const removeChild = (index: number) => setChildren(prev => prev.filter((_, i) => i !== index))

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setStatus('error')
      setErrorMsg('Passwords do not match.')
      return
    }

    if (children.some(c => c.instruments.length === 0)) {
      setStatus('error')
      setErrorMsg('Please select at least one instrument for each child.')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: parentName, email, password, children }),
    })

    const data = await res.json()
    if (res.ok) {
      router.push('/dashboard/parent')
      router.refresh()
    } else {
      setStatus('error')
      setErrorMsg(data.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Create an account</h1>
      <p className="text-gray-500 mb-8">Sign up as a parent to find free music tutors for your child.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Your info</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
            <input type="text" required value={parentName} onChange={e => setParentName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
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

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Your child{children.length > 1 ? 'ren' : ''}
          </h2>

          {children.map((child, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Child {i + 1}</span>
                {children.length > 1 && (
                  <button type="button" onClick={() => removeChild(i)} className="text-xs text-red-500 hover:text-red-700">
                    Remove
                  </button>
                )}
              </div>
              <input type="text" required placeholder="Child's name" value={child.name}
                onChange={e => updateChild(i, 'name', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <select required value={child.grade} onChange={e => updateChild(i, 'grade', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Grade...</option>
                {GRADES.map(g => <option key={g}>{g}</option>)}
              </select>
              <div>
                <p className="text-xs text-gray-500 mb-2">Instrument(s) — select all that apply</p>
                <div className="flex flex-wrap gap-2">
                  {CHILD_INSTRUMENTS.map(inst => {
                    const selected = child.instruments.includes(inst)
                    return (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => toggleInstrument(i, inst)}
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
            </div>
          ))}

          <button type="button" onClick={addChild} className="text-sm text-gray-500 hover:text-gray-900 underline">
            + Add another child
          </button>
        </div>

        {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}

        <button type="submit" disabled={status === 'loading'}
          className="w-full bg-gray-900 text-white py-3 rounded-md text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">
          {status === 'loading' ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-6">
        Already have an account?{' '}
        <Link href="/signin" className="underline">Sign in</Link>
      </p>
    </div>
  )
}
