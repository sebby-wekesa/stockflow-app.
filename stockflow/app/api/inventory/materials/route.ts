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
    const materials = await prisma.rawMaterial.findMany({
      where: {
        availableKg: {
          gt: 0, // Only show materials with available stock
        },
      },
      orderBy: [
        { materialName: 'asc' },
        { diameter: 'asc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: materials,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch raw materials' },
      { status: 500 }
    )
  }
}