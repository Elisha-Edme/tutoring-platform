import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { getSession } from '@/lib/auth'
import TutorProfilePanel from './TutorProfilePanel'

export default async function TutorDashboard() {
  const session = await getSession()
  if (!session || session.role !== 'tutor') redirect('/signin')

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome, {session.name}</h1>
        <p className="text-gray-500 mb-10">Tutor dashboard</p>

        {/* Profile is loaded/edited client-side to keep googleapis out of the
            page render (route handlers read/write Sheets). */}
        <TutorProfilePanel />
      </div>
    </main>
  )
}
