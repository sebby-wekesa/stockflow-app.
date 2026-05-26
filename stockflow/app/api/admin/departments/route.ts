'use server'

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getDepartmentsForOrg, setDepartmentsForOrg } from '@/lib/department-settings'
import { z } from 'zod'

const bodySchema = z.object({ organizationId: z.string(), departments: z.array(z.string()) })

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const depts = getDepartmentsForOrg(user.organizationId)
  return NextResponse.json({ organizationId: user.organizationId, departments: depts })
}

export async function POST(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = bodySchema.parse(body)
  const success = setDepartmentsForOrg(parsed.organizationId, parsed.departments)
  if (!success) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  return NextResponse.json({ success: true })
}
