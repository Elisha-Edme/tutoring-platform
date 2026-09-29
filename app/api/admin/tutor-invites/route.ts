import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSession } from '@/lib/auth'
import { getUserByEmail, getPendingTutorInviteByEmail, createTutorInvite, getAllTutorInvites } from '@/lib/sheets'
import { sendEmail, tutorInviteEmailHtml } from '@/lib/email'
import type { TutorInvite } from '@/lib/types'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const invites = await getAllTutorInvites()
    invites.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return NextResponse.json({ invites })
  } catch (err) {
    console.error('[admin/tutor-invites] GET', err)
    return NextResponse.json({ error: 'Failed to load invites.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { email } = body

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
    }

    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    // Re-inviting an address with a still-pending invite reuses+resends the
    // same link instead of piling up duplicate rows.
    let invite = await getPendingTutorInviteByEmail(email)
    if (!invite) {
      invite = {
        token: randomBytes(24).toString('base64url'),
        email,
        createdAt: new Date().toISOString(),
        usedAt: '',
      } satisfies TutorInvite
      await createTutorInvite(invite)
    }

    try {
      await sendEmail({
        to: email,
        subject: "You're invited to join Tune Up Together as a tutor",
        html: tutorInviteEmailHtml({
          signupUrl: new URL(`/tutor-signup?token=${invite.token}`, request.url).toString(),
        }),
      })
    } catch (err) {
      console.error('[admin/tutor-invites] failed to send email', err)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/tutor-invites] POST', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
