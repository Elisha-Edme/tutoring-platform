import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTutorStudentsByParent, getTutorByUserId } from '@/lib/sheets'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const students = await getTutorStudentsByParent(session.userId)

  const tutorIds = [...new Set(students.map(s => s.tutorUserId))]
  const tutorMap: Record<string, string> = {}
  await Promise.all(
    tutorIds.map(async id => {
      const t = await getTutorByUserId(id)
      if (t) tutorMap[id] = t.name
    }),
  )

  const enriched = students.map(s => ({
    ...s,
    tutorName: tutorMap[s.tutorUserId] ?? '(unknown)',
  }))

  return NextResponse.json({ students: enriched })
}
