export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    const materials = await db.rawMaterial.findMany({
      where: {
        availableKg: {
          gt: 0, // Only show materials with available stock
        },
      },
      orderBy: [
        { category: 'asc' },
        { materialName: 'asc' },
        { diameter: 'asc' },
        { length: 'asc' },
        { width: 'asc' },
        { height: 'asc' },
      ],
    })

    return NextResponse.json(
      {
        success: true,
        data: materials,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching raw materials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch raw materials' },
      { status: 500 }
    )
  }
}
