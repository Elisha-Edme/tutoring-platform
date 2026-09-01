import Navbar from '@/components/Navbar'

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Contact Us</h1>
        <p className="text-gray-600 mb-12">
          Questions about lessons, volunteering, or partnering with us? We&apos;d love to hear
          from you.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
          <div className="border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Email</h2>
            <a href="mailto:info@tuneuptogether.org" className="text-gray-900 hover:underline">
              info@tuneuptogether.org
            </a>
          </div>
          <div className="border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Follow us</h2>
            <div className="flex flex-col gap-1">
              <a href="https://www.instagram.com/tuneuptogether" target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">
                Instagram
              </a>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-12">
          Tune Up Together is a nonprofit connecting high school musicians with younger students
          for free lessons.
        </p>
      </section>
    </main>
  )
}
