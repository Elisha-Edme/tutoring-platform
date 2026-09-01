import Link from 'next/link'
import { getSession } from '@/lib/auth'
import SignOutButton from './SignOutButton'

export default async function Navbar() {
  const session = await getSession()
  const dashboardHref = session?.role === 'tutor' ? '/dashboard/tutor' : '/dashboard/parent'

  return (
    <nav className="w-full border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
      <Link href="/" className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Tune Up Together" className="h-10 w-auto" />
      </Link>

      <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
        {session ? (
          <Link href={dashboardHref} className="hover:text-gray-900">Dashboard</Link>
        ) : (
          <Link href="/" className="hover:text-gray-900">Home</Link>
        )}
        <Link href="/tutors" className="hover:text-gray-900">Find a Tutor</Link>
        <Link href="/contact" className="hover:text-gray-900">Contact Us</Link>
      </div>

      <div className="flex items-center gap-4">
        {session ? (
          <>
            <Link href={dashboardHref} className="text-sm text-gray-700 hover:text-gray-900">
              {session.name}
            </Link>
            <SignOutButton />
          </>
        ) : (
          <Link
            href="/signin"
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}
