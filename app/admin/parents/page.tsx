import Navbar from '@/components/Navbar'
import AdminParentsPanel from './AdminParentsPanel'

export default function AdminParentsPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Parents</h1>
        <p className="text-gray-500 mb-10">All parent accounts on the platform.</p>
        <AdminParentsPanel />
      </div>
    </main>
  )
}
