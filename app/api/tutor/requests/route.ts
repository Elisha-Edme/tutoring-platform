import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLessonRequestsByTutor, getParentProfile, getOccurrencesByTutor, getTutorStudentsByTutor } from '@/lib/sheets'
import { expandLessonRequestOccurrences, applyOccurrenceOverrides, describeLessonRecurrence } from '@/lib/schedule'
import { isTerminalOccurrence } from '@/lib/lessons'
import type { LessonRequest, LessonOccurrence } from '@/lib/types'

// The next occurrence that isn't resolved yet — i.e. hasn't been
// auto-completed by cron or manually completed/cancelled/no-showed yet. An
// 'upcoming' row (a reminder was already sent for it) doesn't count as
// resolved. Looks back 30 days in case cron is behind, so an overdue
// occurrence still surfaces. Resolved via applyOccurrenceOverrides so an
// approved/overridden reschedule is reflected here too.
function computeNextOccurrence(booking: LessonRequest, allOccurrences: LessonOccurrence[]) {
  if (booking.status !== 'in_progress') return null
  const bookingOccurrences = allOccurrences.filter(o => o.lessonRequestId === booking.id)
  const resolvedDates = new Set(
    bookingOccurrences.filter(o => isTerminalOccurrence(o.status)).map(o => o.occurrenceDate),
  )
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const to = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  const template = expandLessonRequestOccurrences(booking, from, to)
  const effective = applyOccurrenceOverrides(template, booking.id, bookingOccurrences)
  const next = effective.find(o => !resolvedDates.has(o.templateDate))
  return next ? { date: next.date, startTime: next.startTime, endTime: next.endTime } : null
}

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [requests, occurrences, tutorStudents] = await Promise.all([
    getLessonRequestsByTutor(session.userId),
    getOccurrencesByTutor(session.userId),
    getTutorStudentsByTutor(session.userId),
  ])
  requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const pendingCount = requests.filter(r => r.status === 'pending').length

  // A tutor can propose an ongoing relationship once a one-time first lesson
  // completes, unless one's already pending/approved for that exact pair.
  const alreadyRequested = new Set(
    tutorStudents
      .filter(s => s.status === 'pending' || s.status === 'approved')
      .map(s => `${s.parentUserId}|${s.childName}`),
  )

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
    recurrenceLabel: describeLessonRecurrence(r),
    occurrences: occurrences
      .filter(o => o.lessonRequestId === r.id)
      .sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate)),
    nextOccurrence: computeNextOccurrence(r, occurrences),
    canAddStudent: r.status === 'complete' && r.repeatType === 'once'
      && !alreadyRequested.has(`${r.parentUserId}|${r.childName}`),
  }))

  return NextResponse.json({ requests: enriched, pendingCount })
}
