import Navbar from '@/components/Navbar'
import { getAllTutors } from '@/lib/sheets'
import TutorGrid from './TutorGrid'
import type { TutorProfile } from '@/lib/types'

export default async function TutorsPage() {
  let tutors: TutorProfile[] = []
  try {
    tutors = await getAllTutors()
  } catch {
    // Sheets not configured yet — show empty state
  }

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Our Tutors</h1>
        <p className="text-gray-600 mb-10">
          High school musicians offering free lessons to elementary and middle school students.
        </p>
        {tutors.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No tutors yet. Use the admin panel to seed tutors.
          </p>
        ) : (
          <TutorGrid tutors={tutors} />
        )}
      </div>
    </main>
  )
}
