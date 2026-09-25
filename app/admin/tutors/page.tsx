import Navbar from '@/components/Navbar'
import AdminTutorsPanel from './AdminTutorsPanel'

export default function AdminTutorsPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Tutors</h1>
        <p className="text-gray-500 mb-10">All tutor accounts on the platform.</p>
        <AdminTutorsPanel />
      </div>
    </main>
  )
}
