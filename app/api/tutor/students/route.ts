import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getTutorStudentsByTutor,
  createTutorStudent,
  deleteTutorStudent,
  getParentProfile,
} from '@/lib/sheets'
import type { TutorStudent } from '@/lib/types'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const students = await getTutorStudentsByTutor(session.userId)

  // Enrich with parent names.
  const parentIds = [...new Set(students.map(s => s.parentUserId))]
  const parentMap: Record<string, string> = {}
  await Promise.all(
    parentIds.map(async id => {
      const p = await getParentProfile(id)
      if (p) parentMap[id] = p.name
    }),
  )

  const enriched = students.map(s => ({
    ...s,
    parentName: parentMap[s.parentUserId] ?? '(unknown)',
  }))

  return NextResponse.json({ students: enriched })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { parentUserId, childName } = body

  if (!parentUserId || !childName) {
    return NextResponse.json({ error: 'Missing parentUserId or childName.' }, { status: 400 })
  }

  // Verify the child actually belongs to that parent.
  const profile = await getParentProfile(parentUserId)
  if (!profile) {
    return NextResponse.json({ error: 'Parent not found.' }, { status: 404 })
  }
  const childExists = profile.children.some(c => c.name === childName)
  if (!childExists) {
    return NextResponse.json({ error: 'Child not found under that parent.' }, { status: 404 })
  }

  // Check for duplicate.
  const existing = await getTutorStudentsByTutor(session.userId)
  if (existing.find(s => s.parentUserId === parentUserId && s.childName === childName)) {
    return NextResponse.json({ error: 'That student is already in your list.' }, { status: 409 })
  }

  const ts: TutorStudent = {
    tutorUserId: session.userId,
    parentUserId,
    childName,
    addedAt: new Date().toISOString(),
  }
  await createTutorStudent(ts)
  return NextResponse.json({ ok: true, student: ts })
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'tutor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { parentUserId, childName } = body

  if (!parentUserId || !childName) {
    return NextResponse.json({ error: 'Missing parentUserId or childName.' }, { status: 400 })
  }

  await deleteTutorStudent(session.userId, parentUserId, childName)
  return NextResponse.json({ ok: true })
}
