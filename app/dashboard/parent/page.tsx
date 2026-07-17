import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { getSession } from '@/lib/auth'
import { getParentProfile } from '@/lib/sheets'

export default async function ParentDashboard() {
  const session = await getSession()
  if (!session || session.role !== 'parent') redirect('/signin')

  let profile = null
  try {
    profile = await getParentProfile(session.userId)
  } catch {
    // Sheets not yet configured — show empty state
  }

  const children = profile?.children ?? []

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Welcome, {session.name}
        </h1>
        <p className="text-gray-500 mb-10">Parent dashboard</p>

        {children.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Your children
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {children.map((child, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <p className="font-medium text-gray-900">{child.name}</p>
                  <p className="text-sm text-gray-500">{child.grade} grade · {child.instrument}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
            Upcoming sessions
          </h2>
          <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-400 text-sm">No upcoming sessions yet.</p>
            <Link
              href="/tutors"
              className="mt-4 inline-block bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700 transition"
            >
              Find a tutor
            </Link>
          </div>
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
