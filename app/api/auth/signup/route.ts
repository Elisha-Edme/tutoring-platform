import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUserByEmail, createUser, createParentProfile } from '@/lib/sheets'
import { hashPassword, signSession } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, children } = body

    if (!name || !email || !password || !children?.length) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const existing = await getUserByEmail(email)
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const userId = randomUUID()
    const now = new Date().toISOString()
    const passwordHash = hashPassword(password)

    await createUser({ id: userId, email, name, role: 'parent', passwordHash, createdAt: now })
    await createParentProfile({ userId, email, name, children })

    const sessionToken = await signSession({ userId, email, name, role: 'parent' })
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
    console.error('[signup]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
