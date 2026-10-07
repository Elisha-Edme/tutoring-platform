import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import {
  getTutorInviteByToken, markTutorInviteUsed,
  getUserByEmail, createUser, createTutorProfile,
} from '@/lib/sheets'
import { signSession } from '@/lib/auth'
import { DEFAULT_AVATAR_URL } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, name, instruments, bio, credentials, location, password } = body

    if (!token || !name || !instruments?.length || !password) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const invite = await getTutorInviteByToken(token)
    if (!invite) return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
    if (invite.usedAt) return NextResponse.json({ error: 'This invite has already been used.' }, { status: 410 })

    const existing = await getUserByEmail(invite.email)
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const userId = randomUUID()
    const now = new Date().toISOString()
    const passwordHash = password // plaintext (demo); re-add hashing before launch

    await createUser({ id: userId, email: invite.email, name, role: 'tutor', passwordHash, createdAt: now })
    await createTutorProfile({
      userId, email: invite.email, name,
      instruments: Array.isArray(instruments) ? instruments : [instruments],
      bio: bio ?? '',
      school: '',
      credentials: credentials ?? '',
      location: location ?? '',
      photoUrl: DEFAULT_AVATAR_URL,
      lessonsCompleted: 0,
      hoursCompleted: 0,
      rating: 0,
    })
    await markTutorInviteUsed(token)

    const sessionToken = await signSession({ userId, email: invite.email, name, role: 'tutor' })
    const cookieStore = await cookies()
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[tutor-signup]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
