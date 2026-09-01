import Navbar from '@/components/Navbar'
import TutorGrid from './TutorGrid'
import { getSession } from '@/lib/auth'

export default async function TutorsPage() {
  const session = await getSession()
  const isParent = session?.role === 'parent'

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Our Tutors</h1>
        <p className="text-gray-600 mb-10">
          High school musicians offering free lessons to elementary and middle school students.
        </p>
        {/* TutorGrid fetches /api/tutors on the client — keeps googleapis out of
            the page render, which crashes Next.js 16 with "ArrayBuffer is not
            detachable". Route handlers read Sheets fine. */}
        <TutorGrid isParent={isParent} />
      </div>
    </main>
  )
}
