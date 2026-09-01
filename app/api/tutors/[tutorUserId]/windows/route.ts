import { NextRequest, NextResponse } from 'next/server'
import { getAvailabilityRulesByTutor, getExceptionsByTutor } from '@/lib/sheets'
import { getAvailableWindows } from '@/lib/schedule'

// Public — no auth required. Returns raw availability windows (not subdivided)
// so the booking UI can show what hours the tutor is free each day.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tutorUserId: string }> },
) {
  const { tutorUserId } = await params
  const { searchParams } = new URL(request.url)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')
  const from = fromStr ? new Date(`${fromStr}T00:00:00`) : today
  const to = toStr
    ? new Date(`${toStr}T23:59:59`)
    : new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)

  const [rules, exceptions] = await Promise.all([
    getAvailabilityRulesByTutor(tutorUserId),
    getExceptionsByTutor(tutorUserId),
  ])

  const windows = getAvailableWindows(rules, exceptions, from, to)

  // Group by date for easy lookup in the UI.
  const byDate: Record<string, { startTime: string; endTime: string }[]> = {}
  for (const w of windows) {
    ;(byDate[w.date] ??= []).push({ startTime: w.startTime, endTime: w.endTime })
  }

  return NextResponse.json({ windows: byDate })
}
