import Navbar from '@/components/Navbar'
import TutorSignUpForm from './TutorSignUpForm'

export default async function TutorSignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <TutorSignUpForm token={token ?? ''} />
    </main>
  )
}
