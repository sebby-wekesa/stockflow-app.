import { NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { withRetry } from '@/lib/prisma'

const LOW_STOCK_THRESHOLD = 50

export async function GET() {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const stats = await withRetry(async () => ({
      totalRawMaterials: await db.rawMaterial.count(),
      lowStockItems: await db.rawMaterial.count({ where: { availableKg: { lt: LOW_STOCK_THRESHOLD } } }),
      recentDeliveries: await db.materialReceipt.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      pendingOrders: await db.productionOrder.count({ where: { status: 'PENDING' } }),
    }))

    return NextResponse.json({
      totalRawMaterials: stats.totalRawMaterials,
      lowStockItems: stats.lowStockItems,
      recentDeliveries: stats.recentDeliveries,
      pendingOrders: stats.pendingOrders
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('Warehouse stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouse stats' },
      { status: 500 }
    )
  }
}
