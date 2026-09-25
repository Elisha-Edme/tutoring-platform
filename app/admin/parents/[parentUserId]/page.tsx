import Navbar from '@/components/Navbar'
import AdminParentDetail from './AdminParentDetail'

export default async function AdminParentDetailPage({
  params,
}: {
  params: Promise<{ parentUserId: string }>
}) {
  const { parentUserId } = await params

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <AdminParentDetail parentUserId={parentUserId} />
      </div>
    </main>
  )
}
