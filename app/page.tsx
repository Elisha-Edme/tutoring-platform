import Link from 'next/link'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { getSession } from '@/lib/auth'

const STATS = [
  { value: '211', label: 'lessons taught' },
  { value: '170', label: 'hours completed' },
  { value: '35', label: 'volunteer tutors' },
]

const STEPS = [
  { n: '1', title: 'Browse tutors', body: 'Explore our roster of high school musicians and filter by instrument.' },
  { n: '2', title: 'Create an account', body: 'Sign up as a parent and add your child’s name, grade, and instruments.' },
  { n: '3', title: 'Get matched', body: 'Connect with a tutor and start free lessons in your community.' },
]

export default async function Home() {
  // Signed-in users belong on their dashboard, not the marketing page.
  const session = await getSession()
  if (session?.role === 'parent') redirect('/dashboard/parent')
  if (session?.role === 'tutor') redirect('/dashboard/tutor')

  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-16 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Tune Up Together" className="mx-auto h-48 w-auto mb-4" />
        <h1 className="sr-only">Tune Up Together</h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          A nonprofit connecting high-achieving high school musicians with elementary and middle
          school students — providing <span className="text-gray-900 font-medium">free lessons</span> that
          help every young musician grow and excel.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/tutors" className="bg-gray-900 text-white px-6 py-3 rounded-md text-sm font-medium hover:bg-gray-700 transition">
            Find a Tutor
          </Link>
          <Link href="/signup" className="border border-gray-300 px-6 py-3 rounded-md text-sm font-medium hover:border-gray-500 transition">
            Create an Account
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-12 flex justify-center gap-12 sm:gap-20">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {STEPS.map(step => (
            <div key={step.n} className="text-center">
              <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold mx-auto mb-4">
                {step.n}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to get started?</h2>
        <p className="text-gray-600 mb-8">Find the right tutor for your child today — completely free.</p>
        <Link href="/tutors" className="bg-gray-900 text-white px-6 py-3 rounded-md text-sm font-medium hover:bg-gray-700 transition">
          Browse Tutors
        </Link>
      </section>
    </main>
  )
}
