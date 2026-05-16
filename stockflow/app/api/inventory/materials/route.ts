export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
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