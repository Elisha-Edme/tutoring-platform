import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAllParentProfiles, getAllChildren } from '@/lib/sheets'
import type { Child } from '@/lib/types'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [parents, children] = await Promise.all([getAllParentProfiles(), getAllChildren()])

  const childrenByParent = new Map<string, Child[]>()
  for (const c of children) {
    childrenByParent.set(c.parentUserId, [...(childrenByParent.get(c.parentUserId) ?? []), c])
  }

  const enriched = parents.map(p => ({ ...p, children: childrenByParent.get(p.userId) ?? [] }))
  return NextResponse.json(enriched)
}
