import Link from 'next/link'
import Navbar from '@/components/Navbar'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">Tune Up Together</h1>
        <p className="text-lg text-gray-600 mb-4">
          A nonprofit organization dedicated to giving every young musician
          the opportunity to grow and excel.
        </p>
        <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">Our Mission</h2>
        <p className="text-gray-600 mb-10">
          We connect high-achieving high school musicians with elementary and middle school
          students, providing free lessons that help them develop their skills and take
          their music to the next level.
        </p>

        <div className="flex justify-center gap-16 mb-12">
          <div>
            <p className="text-4xl font-bold text-gray-900">211</p>
            <p className="text-sm text-gray-500 mt-1">lessons taught</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900">170</p>
            <p className="text-sm text-gray-500 mt-1">hours completed</p>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Link
            href="/tutors"
            className="bg-gray-900 text-white px-6 py-3 rounded-md text-sm hover:bg-gray-700 transition"
          >
            Find a Tutor
          </Link>
          <Link
            href="/signup"
            className="border border-gray-300 px-6 py-3 rounded-md text-sm hover:border-gray-500 transition"
          >
            Create an Account
          </Link>
        </div>
      </section>
    </main>
  )
}
