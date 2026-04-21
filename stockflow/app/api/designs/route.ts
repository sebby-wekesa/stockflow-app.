export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const designs = await prisma.design.findMany({
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
    console.error('Error fetching designs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch designs' },
      { status: 500 }
    )
  }
}
