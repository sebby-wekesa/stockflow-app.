export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireActiveAuth()
    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
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

      // Validate the selected material exists. Stock is reserved only after
      // manager approval, through the shared production approval lifecycle.
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
      // Generate order number
      const orderNumber = `PO-${Date.now().toString().slice(-6)}`

      // Create production order (organizationId injected by tenant client)
      const productionOrder = await tx.productionOrder.create({
        data: {
          orderNumber,
          designId,
          quantity,
          targetKg: requiredKg,
          status: 'PENDING',
          priority: 'MEDIUM',
          currentStage: firstStage.sequence,
          currentDept: firstStage.department,
        },
      })

      return productionOrder
    })

    return NextResponse.json(
      {
        message: 'Production order created and sent for approval',
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
