import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/sheets'
import { signSession } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const user = await getUserByEmail(email)
    if (!user || user.passwordHash !== password) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    const sessionToken = await signSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    const cookieStore = await cookies()
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    return NextResponse.json({ ok: true, role: user.role })
  } catch (err) {
    console.error('[signin]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
