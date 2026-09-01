import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createAvailabilityException,
  deleteAvailabilityException,
  getExceptionsByTutor,
} from '@/lib/sheets'
import type { AvailabilityException } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  const { startDate, endDate, type = 'blocked', startTime = '', endTime = '' } = body

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required fields (startDate, endDate).' }, { status: 400 })
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: 'endDate must be on or after startDate.' }, { status: 400 })
  }
  if (type === 'modified' && (!startTime || !endTime)) {
    return NextResponse.json({ error: 'Modified exceptions require startTime and endTime.' }, { status: 400 })
  }

  const exc: AvailabilityException = {
    id: `exc_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    tutorUserId: session.userId,
    startDate, endDate, type, startTime, endTime,
    createdAt: new Date().toISOString(),
  }

  await createAvailabilityException(exc)
  return NextResponse.json({ ok: true, exception: exc })
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const exceptions = await getExceptionsByTutor(session.userId)
  if (!exceptions.find(e => e.id === id)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  await deleteAvailabilityException(id)
  return NextResponse.json({ ok: true })
}
