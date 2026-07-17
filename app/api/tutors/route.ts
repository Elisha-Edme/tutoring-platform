import { NextResponse } from 'next/server'
import { getAllTutors } from '@/lib/sheets'

export async function GET() {
  try {
    const tutors = await getAllTutors()
    return NextResponse.json(tutors)
  } catch (err) {
    console.error('[tutors]', err)
    return NextResponse.json({ error: 'Failed to fetch tutors.' }, { status: 500 })
  }
}
