import type { TutorAvailabilityRule, AvailabilityException, LessonRequest, LessonOccurrence, Slot } from './types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Structural shape shared by TutorAvailabilityRule and the adapter built from
// a LessonRequest booking in expandLessonRequestOccurrences — lets expandRule
// serve both without either type depending on the other. TutorAvailabilityRule
// (whose repeatType never includes 'once') is still assignable here since its
// repeatType union is a subset of this one.
interface RecurrenceRule {
  startTime: string
  endTime: string
  repeatType: 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  repeatInterval: number
  repeatDays: string[]
  endsType: 'never' | 'on' | 'after'
  endsDate: string
  endsAfterCount: number
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Parse YYYY-MM-DD as a local midnight Date (avoids UTC timezone shift).
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function subdivideWindow(
  date: string,
  windowStart: string,
  windowEnd: string,
  durationMinutes: number,
): Slot[] {
  const slots: Slot[] = []
  let start = toMinutes(windowStart)
  const end = toMinutes(windowEnd)
  while (start + durationMinutes <= end) {
    slots.push({ date, startTime: fromMinutes(start), endTime: fromMinutes(start + durationMinutes) })
    start += durationMinutes
  }
  return slots
}

// Expand one recurrence rule into time windows within [from, to] (inclusive),
// anchored on the given date (day zero for the recurrence math). Callers pass
// their own anchor: TutorAvailabilityRule uses its createdAt date;
// expandLessonRequestOccurrences (below) uses the booking's requestedDate.
// Returns an array of { date, startTime, endTime } window objects (not yet subdivided).
export function expandRule(
  rule: RecurrenceRule,
  anchor: Date,
  from: Date,
  to: Date,
): Array<{ date: string; startTime: string; endTime: string }> {
  const results: Array<{ date: string; startTime: string; endTime: string }> = []

  // Walk forward from max(anchor, from) one day at a time.
  const cursor = new Date(Math.max(anchor.getTime(), from.getTime()))
  cursor.setHours(0, 0, 0, 0)

  let occurrenceCount = 0

  while (cursor <= to) {
    const dateStr = toDateString(cursor)
    const dayName = DAY_NAMES[cursor.getDay()]

    // Days elapsed from anchor (always non-negative; we start at max(anchor, from))
    const diffMs = cursor.getTime() - anchor.getTime()
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
    const diffWeeks = Math.floor(diffDays / 7)

    let matches = false

    switch (rule.repeatType) {
      case 'once':
        matches = diffDays === 0
        break
      case 'daily':
        matches = diffDays % rule.repeatInterval === 0
        break
      case 'weekly':
        matches = rule.repeatDays.includes(dayName) && diffWeeks % rule.repeatInterval === 0
        break
      // biweekly = weekly every 2 weeks
      case 'biweekly':
        matches = rule.repeatDays.includes(dayName) && diffWeeks % 2 === 0
        break
      case 'monthly': {
        // Same day-of-month as the anchor, every N months.
        if (cursor.getDate() === anchor.getDate()) {
          const monthsElapsed = (cursor.getFullYear() - anchor.getFullYear()) * 12
            + (cursor.getMonth() - anchor.getMonth())
          matches = monthsElapsed % rule.repeatInterval === 0
        }
        break
      }
      case 'yearly': {
        // Same month+day as the anchor, every N years.
        if (cursor.getMonth() === anchor.getMonth() && cursor.getDate() === anchor.getDate()) {
          const yearsElapsed = cursor.getFullYear() - anchor.getFullYear()
          matches = yearsElapsed % rule.repeatInterval === 0
        }
        break
      }
    }

    if (matches) {
      // Check end condition before recording.
      if (rule.endsType === 'on' && rule.endsDate && dateStr > rule.endsDate) break
      if (rule.endsType === 'after' && occurrenceCount >= rule.endsAfterCount) break

      occurrenceCount++
      results.push({ date: dateStr, startTime: rule.startTime, endTime: rule.endTime })
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return results
}

// Shared: expand exceptions into blocked/modified day maps.
function processExceptions(exceptions: AvailabilityException[]): {
  blockedDates: Set<string>
  modifiedDates: Map<string, { startTime: string; endTime: string }>
} {
  const blockedDates = new Set<string>()
  const modifiedDates = new Map<string, { startTime: string; endTime: string }>()
  for (const exc of exceptions) {
    const rangeStart = parseLocalDate(exc.startDate)
    const rangeEnd = parseLocalDate(exc.endDate)
    const cursor = new Date(rangeStart)
    while (cursor <= rangeEnd) {
      const dateStr = toDateString(cursor)
      if (exc.type === 'blocked') {
        blockedDates.add(dateStr)
      } else if (exc.type === 'modified' && exc.startTime && exc.endTime) {
        modifiedDates.set(dateStr, { startTime: exc.startTime, endTime: exc.endTime })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return { blockedDates, modifiedDates }
}

// Subtracts `booked` from `window` (same date only) — full/partial overlap
// splits the window into 0, 1, or 2 remaining pieces.
function subtractInterval(
  window: { date: string; startTime: string; endTime: string },
  booked: { date: string; startTime: string; endTime: string },
): Array<{ date: string; startTime: string; endTime: string }> {
  if (window.date !== booked.date) return [window]
  const wStart = toMinutes(window.startTime)
  const wEnd = toMinutes(window.endTime)
  const bStart = toMinutes(booked.startTime)
  const bEnd = toMinutes(booked.endTime)
  if (bEnd <= wStart || bStart >= wEnd) return [window]

  const pieces: Array<{ date: string; startTime: string; endTime: string }> = []
  if (bStart > wStart) pieces.push({ date: window.date, startTime: window.startTime, endTime: fromMinutes(bStart) })
  if (bEnd < wEnd) pieces.push({ date: window.date, startTime: fromMinutes(bEnd), endTime: window.endTime })
  return pieces
}

function subtractIntervals(
  windows: Array<{ date: string; startTime: string; endTime: string }>,
  booked: Array<{ date: string; startTime: string; endTime: string }>,
): Array<{ date: string; startTime: string; endTime: string }> {
  let result = windows
  for (const b of booked) {
    result = result.flatMap(w => subtractInterval(w, b))
  }
  return result
}

// Raw availability windows (no slot subdivision) — used by the booking UI to
// show which hours a tutor is free on a given day. `booked` (optional) is
// time already reserved by accepted lesson bookings, subtracted from the
// result — defaults to [] so existing callers are unaffected.
export function getAvailableWindows(
  rules: TutorAvailabilityRule[],
  exceptions: AvailabilityException[],
  from: Date,
  to: Date,
  booked: Array<{ date: string; startTime: string; endTime: string }> = [],
): Array<{ date: string; startTime: string; endTime: string }> {
  const { blockedDates, modifiedDates } = processExceptions(exceptions)
  let windows: Array<{ date: string; startTime: string; endTime: string }> = []

  for (const rule of rules) {
    for (const win of expandRule(rule, parseLocalDate(rule.createdAt.slice(0, 10)), from, to)) {
      if (blockedDates.has(win.date)) continue
      const override = modifiedDates.get(win.date)
      windows.push({
        date: win.date,
        startTime: override?.startTime ?? win.startTime,
        endTime: override?.endTime ?? win.endTime,
      })
    }
  }

  if (booked.length > 0) windows = subtractIntervals(windows, booked)

  const seen = new Set<string>()
  return windows
    .filter(w => {
      const key = `${w.date}|${w.startTime}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime),
    )
}

// Compute all bookable slots for a tutor in [from, to], applying exceptions.
// slotDurationMinutes controls how each availability window is subdivided (default 60 min).
export function getAvailableSlots(
  rules: TutorAvailabilityRule[],
  exceptions: AvailabilityException[],
  from: Date,
  to: Date,
  slotDurationMinutes = 60,
): Slot[] {
  const { blockedDates, modifiedDates } = processExceptions(exceptions)
  const allSlots: Slot[] = []

  for (const rule of rules) {
    for (const win of expandRule(rule, parseLocalDate(rule.createdAt.slice(0, 10)), from, to)) {
      if (blockedDates.has(win.date)) continue
      const override = modifiedDates.get(win.date)
      const startTime = override?.startTime ?? win.startTime
      const endTime = override?.endTime ?? win.endTime
      allSlots.push(...subdivideWindow(win.date, startTime, endTime, slotDurationMinutes))
    }
  }

  const seen = new Set<string>()
  return allSlots
    .filter(s => {
      const key = `${s.date}|${s.startTime}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime),
    )
}

// Group slots by date — convenient for the booking calendar UI.
export function groupSlotsByDate(slots: Slot[]): Record<string, Slot[]> {
  const map: Record<string, Slot[]> = {}
  for (const slot of slots) {
    ;(map[slot.date] ??= []).push(slot)
  }
  return map
}

// Format HH:MM (24-hour) as "4:00 PM" for display.
export function formatTime(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${mStr} ${ampm}`
}

// Add `minutes` to an HH:MM (24-hour) time, wrapping past midnight rather
// than overflowing — used to seed a lesson's default end time from its start.
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = (h * 60 + m + minutes + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// True if [startTime, endTime) falls entirely within at least one of a day's
// (possibly disjoint) available windows. Shared by BookingModal (new lesson)
// and the parent's reschedule ProposeForm (existing lesson) so the "is this
// time actually free" rule only lives in one place.
export function isRangeWithinWindows(
  startTime: string,
  endTime: string,
  windows: Array<{ startTime: string; endTime: string }>,
): boolean {
  return windows.some(w => w.startTime <= startTime && endTime <= w.endTime)
}

// Summarise a rule as a human-readable string, e.g. "Mon, Wed · 4:00 PM–6:00 PM"
export function describeRule(rule: TutorAvailabilityRule): string {
  const days = rule.repeatDays.length ? rule.repeatDays.join(', ') + ' · ' : ''
  const times = `${formatTime(rule.startTime)}–${formatTime(rule.endTime)}`
  return `${days}${times}`
}

// Expand a booking's own recurrence into concrete occurrences within
// [from, to], anchored on its requestedDate (its first occurrence). Pick<>
// (not the full LessonRequest) so a candidate that isn't a real booking yet
// — e.g. findSchedulingConflict's write-time conflict check — can reuse this
// without needing the rest of LessonRequest's fields.
export function expandLessonRequestOccurrences(
  booking: Pick<LessonRequest, 'requestedDate' | 'requestedStartTime' | 'requestedEndTime'
    | 'repeatType' | 'repeatInterval' | 'repeatDays' | 'endsType' | 'endsDate' | 'endsAfterCount'>,
  from: Date,
  to: Date,
): Array<{ date: string; startTime: string; endTime: string }> {
  const adapter: RecurrenceRule = {
    startTime: booking.requestedStartTime,
    endTime: booking.requestedEndTime,
    repeatType: booking.repeatType,
    repeatInterval: booking.repeatInterval,
    repeatDays: booking.repeatDays,
    endsType: booking.endsType,
    endsDate: booking.endsDate,
    endsAfterCount: booking.endsAfterCount,
  }
  return expandRule(adapter, parseLocalDate(booking.requestedDate), from, to)
}

// Merges a booking's live-computed template occurrences with whatever's
// actually been recorded for them (a reschedule, or nothing) — the one piece
// of machinery that lets an approved/overridden time change propagate to
// double-booking prevention, cron, and "next occurrence" display without any
// of them needing to know rescheduling exists. occurrenceDate on a stored row
// is always the template date (the lookup key) — never the rescheduled one —
// so callers that need to key off the original slot use `templateDate`.
export function applyOccurrenceOverrides(
  templateOccs: Array<{ date: string; startTime: string; endTime: string }>,
  lessonRequestId: string,
  occurrences: LessonOccurrence[],
): Array<{ templateDate: string; date: string; startTime: string; endTime: string }> {
  const byDate = new Map<string, LessonOccurrence>()
  for (const o of occurrences) {
    if (o.lessonRequestId === lessonRequestId) byDate.set(o.occurrenceDate, o)
  }
  return templateOccs.map(t => {
    const row = byDate.get(t.date)
    if (!row) return { templateDate: t.date, date: t.date, startTime: t.startTime, endTime: t.endTime }
    return {
      templateDate: t.date,
      date: row.rescheduledDate || t.date,
      startTime: row.occurrenceStartTime || t.startTime,
      endTime: row.occurrenceEndTime || t.endTime,
    }
  })
}

// Time already reserved by a tutor's accepted (in_progress) bookings within
// [from, to] — a single occurrence explicitly cancelled out of an otherwise-
// active series frees that date back up. Reschedules are resolved via
// applyOccurrenceOverrides, so a moved lesson blocks its new date and frees
// its old one; the expansion window is widened first since a reschedule can
// land just outside the caller's [from, to].
export function getBookedIntervals(
  activeBookings: LessonRequest[],
  occurrences: LessonOccurrence[],
  from: Date,
  to: Date,
): Array<{ date: string; startTime: string; endTime: string }> {
  const cancelledKeys = new Set(
    occurrences
      .filter(o => o.status === 'cancelled')
      .map(o => `${o.lessonRequestId}|${o.occurrenceDate}`),
  )
  const fromStr = toDateString(from)
  const toStr = toDateString(to)
  const widenedFrom = new Date(from.getTime() - 14 * 24 * 60 * 60 * 1000)
  const widenedTo = new Date(to.getTime() + 14 * 24 * 60 * 60 * 1000)

  const intervals: Array<{ date: string; startTime: string; endTime: string }> = []
  for (const booking of activeBookings) {
    const template = expandLessonRequestOccurrences(booking, widenedFrom, widenedTo)
    for (const occ of applyOccurrenceOverrides(template, booking.id, occurrences)) {
      if (cancelledKeys.has(`${booking.id}|${occ.templateDate}`)) continue
      if (occ.date < fromStr || occ.date > toStr) continue
      intervals.push({ date: occ.date, startTime: occ.startTime, endTime: occ.endTime })
    }
  }
  return intervals
}

// Summarise a booking's recurrence, e.g. "Weekly · Mon · 4:00 PM–5:00 PM until 2027-06-01"
// Pick<> (not the full LessonRequest) so a lightweight adapter — e.g. a
// TutorStudent's proposed schedule — can reuse this without being a real booking.
export function describeLessonRecurrence(booking: Pick<LessonRequest,
  'repeatType' | 'repeatInterval' | 'repeatDays' | 'requestedStartTime' | 'requestedEndTime'
  | 'endsType' | 'endsDate' | 'endsAfterCount'
>): string {
  if (booking.repeatType === 'once') return 'One-time lesson'
  const cadence = booking.repeatInterval > 1 ? `Every ${booking.repeatInterval} weeks` : 'Weekly'
  const days = booking.repeatDays.length ? booking.repeatDays.join(', ') + ' · ' : ''
  const times = `${formatTime(booking.requestedStartTime)}–${formatTime(booking.requestedEndTime)}`
  const ends =
    booking.endsType === 'on' && booking.endsDate ? ` until ${booking.endsDate}`
    : booking.endsType === 'after' ? ` for ${booking.endsAfterCount} lessons`
    : ''
  return `${cadence} · ${days}${times}${ends}`
}
