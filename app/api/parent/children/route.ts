import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getChildrenByParent, replaceChildren } from '@/lib/sheets'
import type { Child } from '@/lib/types'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const children = await getChildrenByParent(session.userId)
    return NextResponse.json({ children })
  } catch (err) {
    console.error('[parent/children]', err)
    return NextResponse.json({ error: 'Failed to load children.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { children } = await request.json()
    if (!Array.isArray(children)) {
      return NextResponse.json({ error: 'children must be an array.' }, { status: 400 })
    }

    const cleaned: Child[] = children.map((c: Child) => ({
      name: (c?.name ?? '').trim(),
      grade: (c?.grade ?? '').trim(),
      instruments: Array.isArray(c?.instruments) ? c.instruments : [],
    }))

    if (cleaned.some(c => !c.name || !c.grade || c.instruments.length === 0)) {
      return NextResponse.json(
        { error: 'Each child needs a name, a grade, and at least one instrument.' },
        { status: 400 },
      )
    }

    await replaceChildren(session.userId, cleaned)
    return NextResponse.json({ ok: true, children: cleaned })
  } catch (err) {
    console.error('[parent/children PUT]', err)
    return NextResponse.json({ error: 'Failed to save children.' }, { status: 500 })
  }
}
