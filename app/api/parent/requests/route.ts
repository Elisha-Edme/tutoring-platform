import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestsByParent, getTutorByUserId } from '@/lib/sheets'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requests = await getLessonRequestsByParent(session.userId)
  requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // Enrich with tutor names (tutorEmail is stored but name is friendlier in UI).
  const tutorIds = [...new Set(requests.map(r => r.tutorUserId))]
  const tutorMap: Record<string, string> = {}
  await Promise.all(
    tutorIds.map(async id => {
      const t = await getTutorByUserId(id)
      if (t) tutorMap[id] = t.name
    }),
  )

  const enriched = requests.map(r => ({
    ...r,
    tutorName: tutorMap[r.tutorUserId] ?? '',
  }))

  return NextResponse.json({ requests: enriched })
}
