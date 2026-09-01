import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <p className="font-bold text-gray-900">Tune Up Together</p>
          <p className="text-sm text-gray-500">Free music lessons for every young musician.</p>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <Link href="/tutors" className="hover:text-gray-900">Find a Tutor</Link>
          <Link href="/signup" className="hover:text-gray-900">Sign Up</Link>
          <Link href="/contact" className="hover:text-gray-900">Contact</Link>
        </div>
      </div>
      <div className="border-t border-gray-100">
        <p className="max-w-5xl mx-auto px-6 py-4 text-xs text-gray-400 text-center sm:text-left">
          © {new Date().getFullYear()} Tune Up Together. A nonprofit organization.
        </p>
      </div>
    </footer>
  )
}
