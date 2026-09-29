import { NextResponse } from 'next/server'
import { getTutorInviteByToken } from '@/lib/sheets'

// Public — this is the pre-signup validity check the signup page calls
// before rendering the form, no session required.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  try {
    const invite = await getTutorInviteByToken(token)
    if (!invite) return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
    if (invite.usedAt) return NextResponse.json({ error: 'This invite has already been used.' }, { status: 410 })
    return NextResponse.json({ email: invite.email })
  } catch (err) {
    console.error('[tutor-invites]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
