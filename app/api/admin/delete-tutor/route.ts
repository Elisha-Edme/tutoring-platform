import { NextRequest, NextResponse } from 'next/server'
import { deleteTutorByEmail } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }
    const deleted = await deleteTutorByEmail(email)
    return NextResponse.json({ ok: true, deleted })
  } catch (err) {
    console.error('[delete-tutor]', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
