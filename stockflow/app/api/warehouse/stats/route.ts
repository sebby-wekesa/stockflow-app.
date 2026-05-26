import { NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

const LOW_STOCK_THRESHOLD = 50

export async function GET() {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    // Parallel — these four counts have no dependencies on each other
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [totalRawMaterials, lowStockItems, recentDeliveries, pendingOrders] = await Promise.all([
      db.rawMaterial.count(),
      db.rawMaterial.count({ where: { availableKg: { lt: LOW_STOCK_THRESHOLD } } }),
      db.materialReceipt.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      db.productionOrder.count({ where: { status: 'PENDING' } }),
    ])

    return NextResponse.json({
      totalRawMaterials,
      lowStockItems,
      recentDeliveries,
      pendingOrders
    })
  } catch (error) {
    console.error('Warehouse stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouse stats' },
      { status: 500 }
    )
  }
}
