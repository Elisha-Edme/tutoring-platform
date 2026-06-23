export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Tutorio</h1>
      <p className="text-lg text-gray-600 max-w-md mb-8">
        Connecting students with tutors in your community. A free platform built
        for families.
      </p>
      <div className="flex gap-4">
        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium opacity-50 cursor-not-allowed">
          Sign up as a Tutor
        </button>
        <button className="border border-gray-300 px-6 py-3 rounded-lg font-medium opacity-50 cursor-not-allowed">
          Find a Tutor
        </button>
      </div>
      <p className="mt-6 text-sm text-gray-400">
        Coming soon — platform in development
      </p>
    </main>
  );
}
