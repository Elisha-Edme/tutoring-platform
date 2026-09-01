import { NextRequest, NextResponse } from 'next/server'
import { getAvailabilityRulesByTutor, getExceptionsByTutor } from '@/lib/sheets'
import { getAvailableSlots } from '@/lib/schedule'

// Public endpoint — no auth required. Returns bookable slots for a tutor
// within the given date range (defaults to today + 28 days).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tutorUserId: string }> },
) {
  const { tutorUserId } = await params
  const { searchParams } = new URL(request.url)

  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const from = fromStr ? new Date(`${fromStr}T00:00:00`) : today
  const to = toStr
    ? new Date(`${toStr}T23:59:59`)
    : new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)

  const [rules, exceptions] = await Promise.all([
    getAvailabilityRulesByTutor(tutorUserId),
    getExceptionsByTutor(tutorUserId),
  ])

  const slots = getAvailableSlots(rules, exceptions, from, to)
  return NextResponse.json({ slots })
}
