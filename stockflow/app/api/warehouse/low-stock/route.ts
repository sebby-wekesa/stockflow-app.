import { NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

const LOW_STOCK_THRESHOLD = 50

export async function GET() {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    const lowStockAlerts = await db.rawMaterial.findMany({
      where: { availableKg: { lt: LOW_STOCK_THRESHOLD } },
      select: {
        id: true,
        materialName: true,
        diameter: true,
        length: true,
        width: true,
        height: true,
        availableKg: true,
        availablePieces: true,
      },
      orderBy: { availableKg: 'asc' }
    })

    return NextResponse.json(lowStockAlerts)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('Low stock alerts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch low stock alerts' },
      { status: 500 }
    )
  }
}
