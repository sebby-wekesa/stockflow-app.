export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    const body = await request.json()
    const { designId, materialId, quantity } = body

    // Validate required fields
    if (!designId || !materialId || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: designId, materialId, quantity' },
        { status: 400 }
      )
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      )
    }

    // Use tenant-scoped transaction
    const result = await withTenantTransaction(user.organizationId, async (tx) => {
      // Check if design exists and get its stages (automatically scoped)
      const design = await tx.design.findUnique({
        where: { id: designId },
        include: {
          stages: {
            orderBy: { sequence: 'asc' },
          },
        },
      })

      if (!design) {
        throw new Error('Design not found')
      }

      if (design.stages.length === 0) {
        throw new Error(`Design "${design.name}" has no production stages configured.`);
      }

      const firstStage = design.stages[0]

      // Check if material exists and has sufficient stock (scoped)
      const material = await tx.rawMaterial.findUnique({
        where: { id: materialId },
      })

      if (!material) {
        throw new Error('Raw material not found')
      }

      // Validate that design has a target weight defined
      if (design.targetWeight === null || design.targetWeight === undefined) {
        throw new Error(`Design "${design.name}" is missing target weight specification. Cannot calculate material requirements.`)
      }

      const requiredKg = design.targetWeight.toNumber() * quantity
      if (material.availableKg.toNumber() < requiredKg) {
        throw new Error(`Insufficient material stock. Required: ${requiredKg}kg, Available: ${material.availableKg.toNumber()}kg`)
      }

      // Generate order number
      const orderNumber = `PO-${Date.now().toString().slice(-6)}`

      // Create production order (organizationId injected by tenant client)
      const productionOrder = await tx.productionOrder.create({
        data: {
          orderNumber,
          designId,
          quantity,
          targetKg: requiredKg,
          status: 'IN_PRODUCTION',
          priority: 'MEDIUM',
          currentStage: firstStage.sequence,
          currentDept: firstStage.department,
        },
      })

      // Reserve material (scoped)
      await tx.rawMaterial.update({
        where: { id: materialId },
        data: {
          availableKg: material.availableKg.toNumber() - requiredKg,
          reservedKg: material.reservedKg.toNumber() + requiredKg,
        },
      })

      return productionOrder
    })

    return NextResponse.json(
      {
        message: 'Production order created and material reserved successfully',
        order: result,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating production order:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create production order' },
      { status: 500 }
    )
  }
}
