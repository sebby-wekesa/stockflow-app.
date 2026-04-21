export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { designId, materialId, quantity, customerRef } = body

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

    // Use Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check if design exists and get its stages
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

      // Check if material exists and has sufficient stock
      const material = await tx.rawMaterial.findUnique({
        where: { id: materialId },
      })

      if (!material) {
        throw new Error('Raw material not found')
      }

      const requiredKg = design.targetWeight * quantity
      if (material.availableKg < requiredKg) {
        throw new Error(`Insufficient material stock. Required: ${requiredKg}kg, Available: ${material.availableKg}kg`)
      }

      // Generate order number
      const orderNumber = `PO-${Date.now().toString().slice(-6)}`

      // Create production order
      const productionOrder = await tx.productionOrder.create({
        data: {
          orderNumber,
          designId,
          quantity,
          targetKg: requiredKg,
          status: 'IN_PRODUCTION',
          priority: 'MEDIUM',
          currentStage: 1,
          currentDept: design.stages[0]?.department || 'Cutting', // First department
        },
      })

      // Reserve material
      await tx.rawMaterial.update({
        where: { id: materialId },
        data: {
          availableKg: material.availableKg - requiredKg,
          reservedKg: material.reservedKg + requiredKg,
        },
      })

      // Initialize first stage (create a pending task)
      if (design.stages.length > 0) {
        const firstStage = design.stages[0]
        await tx.stageLog.create({
          data: {
            orderId: productionOrder.id,
            stageId: firstStage.id,
            stageName: firstStage.name,
            sequence: firstStage.sequence,
            department: firstStage.department,
            kgIn: requiredKg,
            kgOut: 0,
            kgScrap: 0,
            operatorId: 'system', // Placeholder, should be assigned later
            notes: 'Production order initialized - pending processing',
          },
        })
      }

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