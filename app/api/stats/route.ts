import { NextResponse } from 'next/server'
import { getAllOccurrences } from '@/lib/sheets'
import { computePlatformTotals } from '@/lib/lessons'
import { HISTORICAL_LESSONS, HISTORICAL_HOURS } from '@/lib/constants'

// Public — feeds the landing page's headline numbers. Every visit would
// otherwise cost a Sheets read, and Sheets' read quota is shared with the whole
// app, so let the CDN serve a cached copy for a few minutes.
export async function GET() {
  try {
    const live = computePlatformTotals(await getAllOccurrences())
    return NextResponse.json(
      {
        lessons: HISTORICAL_LESSONS + live.lessons,
        hours: Math.round(HISTORICAL_HOURS + live.hours),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    )
  } catch (err) {
    console.error('[stats]', err)
    return NextResponse.json({ error: 'Failed to load stats.' }, { status: 500 })
  }
}
