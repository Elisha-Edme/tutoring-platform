'use client'

import { useState } from 'react'
import StudentRequestsPanel from './StudentRequestsPanel'
import MyTutorsPanel from './MyTutorsPanel'
import UpcomingLessonsPanel from './UpcomingLessonsPanel'

// Approving a student request can create a relationship and sometimes a
// confirmed lesson in the same action — bumping refreshKey re-fetches
// MyTutorsPanel/UpcomingLessonsPanel so both show up without a page reload,
// the same cross-panel-notify idiom TutorProfilePanel uses for pendingCount.
export default function DashboardPanels() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      <StudentRequestsPanel onDecision={() => setRefreshKey(k => k + 1)} />

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Tutors
        </h2>
        <MyTutorsPanel refreshKey={refreshKey} onRemoved={() => setRefreshKey(k => k + 1)} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Upcoming Lessons
        </h2>
        <UpcomingLessonsPanel refreshKey={refreshKey} />
      </section>
    </>
  )
}
