export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-api'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const designs = await prisma.design.findMany({
      where: { org_id: auth.user.org_id },
      select: {
        id: true,
        name: true,
        description: true,
        targetWeight: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(designs)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch designs' },
      { status: 500 }
    )
  }
}
