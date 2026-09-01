'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignInForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()
    if (res.ok) {
      router.push(data.role === 'tutor' ? '/dashboard/tutor' : '/dashboard/parent')
      router.refresh()
    } else {
      setStatus('error')
      setErrorMsg(data.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-24">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign in</h1>
      <p className="text-gray-500 mb-8">Welcome back.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>

        {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}

        <button type="submit" disabled={status === 'loading'}
          className="w-full bg-gray-900 text-white py-3 rounded-md text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">
          {status === 'loading' ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="underline">Create one</Link>
      </p>
    </div>
  )
}
