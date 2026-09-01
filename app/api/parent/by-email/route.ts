import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUserByEmail, getParentProfile } from '@/lib/sheets'

// Tutors use this to find a parent by email when adding a student.
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.toLowerCase().trim()
  if (!email) return NextResponse.json({ error: 'Missing email.' }, { status: 400 })

  const user = await getUserByEmail(email)
  if (!user || user.role !== 'parent') {
    return NextResponse.json({ error: 'No parent account found with that email.' }, { status: 404 })
  }

  const profile = await getParentProfile(user.id)
  if (!profile) {
    return NextResponse.json({ error: 'Parent profile not found.' }, { status: 404 })
  }

  return NextResponse.json({
    parentUserId: user.id,
    name: profile.name,
    children: profile.children,
  })
}
