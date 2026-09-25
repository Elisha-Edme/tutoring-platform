'use client'

import type { TutorAvailabilityRule, AvailabilityException } from '@/lib/types'
import { formatTime } from '@/lib/schedule'
import {
  DAYS, TOTAL_SLOTS, slotToHHMM, rulesToSelected, bookedToSelected,
} from '@/app/dashboard/tutor/WeeklyAvailabilityGrid'

interface Props {
  rules: TutorAvailabilityRule[]
  bookedExceptions?: AvailabilityException[]
}

// Read-only admin view of a tutor's weekly schedule — same grid/slot math as
// WeeklyAvailabilityGrid.tsx (imported, not duplicated), but with no drag
// selection, editing, or save; just a static visual matching what the tutor
// sees on their own Availability tab.
export default function AdminWeeklyScheduleGrid({ rules, bookedExceptions = [] }: Props) {
  const selected = rulesToSelected(rules)
  const booked = bookedToSelected(bookedExceptions)

  const cellBg = (d: number, s: number): string => {
    const key = `${d}:${s}`
    if (booked.has(key)) return 'bg-blue-400'
    return selected.has(key) ? 'bg-green-400' : 'bg-rose-50'
  }

  return (
    <div className="select-none overflow-x-auto">
      <div className="flex items-center gap-4 mb-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-400" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-400" />
          Booked with a student
        </span>
      </div>
      <div className="inline-flex min-w-full">
        {/* Time labels */}
        <div className="w-16 shrink-0">
          <div className="h-7" />
          {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
            <div key={i} className="h-5 relative">
              {i % 2 === 0 && (
                <span className="absolute right-2 -top-2 text-[10px] leading-none text-gray-400 whitespace-nowrap">
                  {formatTime(slotToHHMM(i))}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((day, d) => (
          <div key={day} className="flex-1 min-w-[38px] border-l border-gray-200 last:border-r border-gray-200">
            <div className="h-7 flex items-center justify-center border-b border-gray-200">
              <span className="text-[11px] font-semibold text-gray-500">{day}</span>
            </div>
            {Array.from({ length: TOTAL_SLOTS }, (_, s) => (
              <div
                key={s}
                title={booked.get(`${d}:${s}`) ? `Booked: ${booked.get(`${d}:${s}`)}` : undefined}
                className={`h-5 ${cellBg(d, s)} ${s % 2 === 0 ? 'border-t border-gray-300' : 'border-t border-gray-100'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
