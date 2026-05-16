import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const LOW_STOCK_THRESHOLD = 50

export async function GET() {
  try {
    const totalRawMaterials = await prisma.rawMaterial.count()
    const lowStockItems = await prisma.rawMaterial.count({
      where: { availableKg: { lt: LOW_STOCK_THRESHOLD } }
    })

    const recentDeliveries = await prisma.materialReceipt.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    })

    const pendingOrders = await prisma.productionOrder.count({
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