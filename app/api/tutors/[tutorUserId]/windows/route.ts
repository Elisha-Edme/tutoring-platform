import { NextRequest, NextResponse } from 'next/server'
import { getAvailabilityRulesByTutor, getExceptionsByTutor, getLessonRequestsByTutor, getOccurrencesByTutor } from '@/lib/sheets'
import { getAvailableWindows, getBookedIntervals } from '@/lib/schedule'

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

  // Defaults to true so the booking-critical path is correct without having
  // to remember to opt in — TutorAvailabilityPreview explicitly opts out
  // since it's a general weekly-shape preview, not a literal calendar.
  const excludeBooked = searchParams.get('excludeBooked') !== 'false'
  // When re-checking availability for an existing booking (e.g. a parent
  // rescheduling it), exclude that booking's own occupied slots — otherwise
  // its own recurrence would make its usual day/time look unavailable.
  const excludeLessonRequestId = searchParams.get('excludeLessonRequestId')

  const [rules, exceptions] = await Promise.all([
    getAvailabilityRulesByTutor(tutorUserId),
    getExceptionsByTutor(tutorUserId),
  ])

  let booked: Array<{ date: string; startTime: string; endTime: string }> = []
  if (excludeBooked) {
    const [requests, occurrences] = await Promise.all([
      getLessonRequestsByTutor(tutorUserId),
      getOccurrencesByTutor(tutorUserId),
    ])
    const activeBookings = requests.filter(r => r.status === 'in_progress' && r.id !== excludeLessonRequestId)
    booked = getBookedIntervals(activeBookings, occurrences, from, to)
  }

  const windows = getAvailableWindows(rules, exceptions, from, to, booked)

  // Group by date for easy lookup in the UI.
  const byDate: Record<string, { startTime: string; endTime: string }[]> = {}
  for (const w of windows) {
    ;(byDate[w.date] ??= []).push({ startTime: w.startTime, endTime: w.endTime })
  }

  return NextResponse.json({ windows: byDate })
}
