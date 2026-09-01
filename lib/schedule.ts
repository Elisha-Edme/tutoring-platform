import type { TutorAvailabilityRule, AvailabilityException, Slot } from './types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

// Expand one availability rule into time windows within [from, to] (inclusive).
// Returns an array of { date, startTime, endTime } window objects (not yet subdivided).
export function expandRule(
  rule: TutorAvailabilityRule,
  from: Date,
  to: Date,
): Array<{ date: string; startTime: string; endTime: string }> {
  const results: Array<{ date: string; startTime: string; endTime: string }> = []

  // Use the rule's createdAt date as the recurrence anchor.
  const anchor = parseLocalDate(rule.createdAt.slice(0, 10))

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
      case 'monthly':
        // Same day-of-month as the anchor.
        matches = cursor.getDate() === anchor.getDate()
        break
      case 'yearly':
        matches =
          cursor.getMonth() === anchor.getMonth() && cursor.getDate() === anchor.getDate()
        break
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

// Raw availability windows (no slot subdivision) — used by the booking UI to
// show which hours a tutor is free on a given day.
export function getAvailableWindows(
  rules: TutorAvailabilityRule[],
  exceptions: AvailabilityException[],
  from: Date,
  to: Date,
): Array<{ date: string; startTime: string; endTime: string }> {
  const { blockedDates, modifiedDates } = processExceptions(exceptions)
  const windows: Array<{ date: string; startTime: string; endTime: string }> = []

  for (const rule of rules) {
    for (const win of expandRule(rule, from, to)) {
      if (blockedDates.has(win.date)) continue
      const override = modifiedDates.get(win.date)
      windows.push({
        date: win.date,
        startTime: override?.startTime ?? win.startTime,
        endTime: override?.endTime ?? win.endTime,
      })
    }
  }

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
    for (const win of expandRule(rule, from, to)) {
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

// Summarise a rule as a human-readable string, e.g. "Mon, Wed · 4:00 PM–6:00 PM"
export function describeRule(rule: TutorAvailabilityRule): string {
  const days = rule.repeatDays.length ? rule.repeatDays.join(', ') + ' · ' : ''
  const times = `${formatTime(rule.startTime)}–${formatTime(rule.endTime)}`
  return `${days}${times}`
}
