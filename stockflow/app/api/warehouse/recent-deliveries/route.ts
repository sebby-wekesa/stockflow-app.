import { NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    const recentDeliveries = await db.materialReceipt.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        RawMaterial: {
          select: { materialName: true, diameter: true }
        }
      }
    })

    const transformedDeliveries = recentDeliveries.map(delivery => ({
      id: delivery.id,
      material: {
        materialName: delivery.RawMaterial.materialName,
        diameter: delivery.RawMaterial.diameter
      },
      kgReceived: delivery.kgReceived,
      createdAt: delivery.createdAt.toISOString()
    }))

    return NextResponse.json(transformedDeliveries)
  } catch (error) {
    console.error('Recent deliveries error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent deliveries' },
      { status: 500 }
    )
  }
}