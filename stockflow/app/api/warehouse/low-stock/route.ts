import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const LOW_STOCK_THRESHOLD = 50

export async function GET() {
  try {
    const lowStockAlerts = await prisma.rawMaterial.findMany({
      where: { availableKg: { lt: LOW_STOCK_THRESHOLD } },
      select: {
        id: true,
        materialName: true,
        diameter: true,
        availableKg: true,
      },
      orderBy: { availableKg: 'asc' }
    })

    return NextResponse.json(lowStockAlerts)
  } catch (error) {
    console.error('Low stock alerts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch low stock alerts' },
      { status: 500 }
    )
  }
}