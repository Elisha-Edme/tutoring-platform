import Navbar from '@/components/Navbar'
import AdminTutorDetail from './AdminTutorDetail'

export default async function AdminTutorDetailPage({
  params,
}: {
  params: Promise<{ tutorUserId: string }>
}) {
  const { tutorUserId } = await params

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <AdminTutorDetail tutorUserId={tutorUserId} />
      </div>
    </main>
  )
}
