import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getAvailabilityRulesByTutor,
  getExceptionsByTutor,
  createAvailabilityRule,
  deleteAvailabilityRule,
} from '@/lib/sheets'
import type { TutorAvailabilityRule } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [rules, exceptions] = await Promise.all([
    getAvailabilityRulesByTutor(session.userId),
    getExceptionsByTutor(session.userId),
  ])
  return NextResponse.json({ rules, exceptions })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  const {
    startTime, endTime,
    repeatType = 'weekly',
    repeatInterval = 1,
    repeatDays = [],
    endsType = 'never', endsDate = '', endsAfterCount = 0,
  } = body

  if (!startTime || !endTime || !Array.isArray(repeatDays) || repeatDays.length === 0) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const rule: TutorAvailabilityRule = {
    id: `avail_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    tutorUserId: session.userId,
    startTime, endTime,
    repeatType, repeatInterval,
    repeatDays,
    endsType, endsDate, endsAfterCount,
    createdAt: new Date().toISOString(),
  }

  await createAvailabilityRule(rule)
  return NextResponse.json({ ok: true, rule })
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  // Verify ownership before deleting.
  const rules = await getAvailabilityRulesByTutor(session.userId)
  if (!rules.find(r => r.id === id)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  await deleteAvailabilityRule(id)
  return NextResponse.json({ ok: true })
}
