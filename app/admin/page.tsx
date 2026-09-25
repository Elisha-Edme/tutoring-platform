import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { getSession } from '@/lib/auth'

export default async function AdminPage() {
  const session = await getSession() // layout already redirected if not an admin

  const links = [
    { href: '/admin/tutors', label: 'Tutors', desc: 'Profiles, availability, students, requests, lesson history' },
    { href: '/admin/parents', label: 'Parents', desc: 'Profiles, children, requests, lesson history' },
    { href: '/admin/create-tutor', label: 'Create tutor', desc: 'Add a new tutor account, or seed the demo roster' },
  ]

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin</h1>
        <p className="text-gray-500 mb-10">Signed in as {session?.name}</p>

        <div className="space-y-3">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="block border border-gray-200 rounded-xl p-4 hover:border-gray-400 transition"
            >
              <p className="font-semibold text-gray-900 text-sm">{l.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{l.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
