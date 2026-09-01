import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestsByTutor, updateLessonRequestStatus } from '@/lib/sheets'

const VALID_STATUSES = ['in_progress', 'complete', 'cancelled'] as const
type UpdateableStatus = typeof VALID_STATUSES[number]

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { status } = body as { status: string }

  if (!VALID_STATUSES.includes(status as UpdateableStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  // Verify the request belongs to this tutor before updating.
  const requests = await getLessonRequestsByTutor(session.userId)
  if (!requests.find(r => r.id === id)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const updated = await updateLessonRequestStatus(id, status as UpdateableStatus)
  if (!updated) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
