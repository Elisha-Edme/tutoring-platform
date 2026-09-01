import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { getSession } from '@/lib/auth'
import ManageChildren from './ManageChildren'
import LessonRequestsList from './LessonRequestsList'

export default async function ParentDashboard() {
  const session = await getSession()
  if (!session || session.role !== 'parent') redirect('/signin')

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Welcome, {session.name}
        </h1>
        <p className="text-gray-500 mb-10">Parent dashboard</p>

        {/* Children are loaded/edited client-side to keep googleapis out of the
            page render (see TutorGrid for the same reason). */}
        <ManageChildren />

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
            Lesson requests
          </h2>
          {/* Fetches /api/parent/requests client-side — keeps googleapis out of render. */}
          <LessonRequestsList />
        </section>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
            Find a tutor
          </h2>
          <Link
            href="/tutors"
            className="inline-block bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition"
          >
            Browse tutors
          </Link>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
            Account
          </h2>
          <p className="text-sm text-gray-600">{session.email}</p>
        </section>
      </div>
    </main>
  )
}
