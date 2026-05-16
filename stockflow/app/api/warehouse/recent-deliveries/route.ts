import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const recentDeliveries = await prisma.materialReceipt.findMany({
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