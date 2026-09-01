'use client'

import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-900 transition">
      Sign out
    </button>
  )
}
