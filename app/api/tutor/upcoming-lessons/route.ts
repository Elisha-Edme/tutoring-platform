import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestsByTutor, getOccurrencesByTutor, getParentProfile } from '@/lib/sheets'
import { expandLessonRequestOccurrences, applyOccurrenceOverrides } from '@/lib/schedule'
import { isTerminalOccurrence } from '@/lib/lessons'

const EIGHT_WEEKS_MS = 8 * 7 * 24 * 60 * 60 * 1000

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [requests, occurrences] = await Promise.all([
    getLessonRequestsByTutor(session.userId),
    getOccurrencesByTutor(session.userId),
  ])
  // Presentation layer only — fine to be stricter than the cron/double-booking
  // filters, which stay status==='in_progress' only (see isHistoryBooking).
  const activeBookings = requests.filter(r => r.status === 'in_progress' && r.acceptedAt)

  const parentIds = [...new Set(activeBookings.map(r => r.parentUserId))]
  const parentMap: Record<string, string> = {}
  await Promise.all(
    parentIds.map(async id => {
      const p = await getParentProfile(id)
      if (p) parentMap[id] = p.name
    }),
  )

  const now = new Date()
  const to = new Date(now.getTime() + EIGHT_WEEKS_MS)

  const lessons = activeBookings.flatMap(booking => {
    const bookingOccurrences = occurrences.filter(o => o.lessonRequestId === booking.id)
    const resolvedDates = new Set(
      bookingOccurrences.filter(o => isTerminalOccurrence(o.status)).map(o => o.occurrenceDate),
    )
    const template = expandLessonRequestOccurrences(booking, now, to)
    const effective = applyOccurrenceOverrides(template, booking.id, bookingOccurrences)
    return effective
      .filter(o => !resolvedDates.has(o.templateDate))
      .map(o => {
        const row = bookingOccurrences.find(occ => occ.occurrenceDate === o.templateDate)
        const scheduledEnd = new Date(`${o.date}T${o.endTime}:00`)
        const hoursUntil = (new Date(`${o.date}T${o.startTime}:00`).getTime() - now.getTime()) / (60 * 60 * 1000)
        return {
          date: o.date,
          startTime: o.startTime,
          endTime: o.endTime,
          templateDate: o.templateDate,
          rescheduledFrom: o.date !== o.templateDate ? o.templateDate : null,
          parentName: parentMap[booking.parentUserId] ?? '',
          childName: booking.childName,
          lessonRequestId: booking.id,
          proposedBy: row?.proposedBy || null,
          proposedDate: row?.proposedDate || null,
          proposedStartTime: row?.proposedStartTime || null,
          proposedEndTime: row?.proposedEndTime || null,
          canPropose: hoursUntil > 48 && !row?.proposedBy,
          canOverride: hoursUntil > 0 && !row?.proposedBy,
          hasPassed: scheduledEnd.getTime() <= now.getTime(),
        }
      })
  })

  lessons.sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime)))

  return NextResponse.json({ lessons })
}
