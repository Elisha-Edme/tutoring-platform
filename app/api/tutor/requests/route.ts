import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestsByTutor, getParentProfile } from '@/lib/sheets'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requests = await getLessonRequestsByTutor(session.userId)
  requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const pendingCount = requests.filter(r => r.status === 'pending').length

  // Enrich with parent name + email (looked up, not stored on the row).
  const parentIds = [...new Set(requests.map(r => r.parentUserId))]
  const parentMap: Record<string, { name: string; email: string }> = {}
  await Promise.all(
    parentIds.map(async id => {
      const p = await getParentProfile(id)
      if (p) parentMap[id] = { name: p.name, email: p.email }
    }),
  )

  const enriched = requests.map(r => ({
    ...r,
    parentName: parentMap[r.parentUserId]?.name ?? '',
    parentEmail: parentMap[r.parentUserId]?.email ?? '',
  }))

  return NextResponse.json({ requests: enriched, pendingCount })
}
