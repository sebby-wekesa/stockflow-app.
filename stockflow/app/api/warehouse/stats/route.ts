import { NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

const LOW_STOCK_THRESHOLD = 50

export async function GET() {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    const totalRawMaterials = await db.rawMaterial.count()
    const lowStockItems = await db.rawMaterial.count({
      where: { availableKg: { lt: LOW_STOCK_THRESHOLD } }
    })

    const recentDeliveries = await db.materialReceipt.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    })

    const pendingOrders = await db.productionOrder.count({
      where: { status: 'PENDING' }
    })

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