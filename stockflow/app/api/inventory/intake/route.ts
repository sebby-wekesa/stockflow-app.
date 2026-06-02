export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { normalizeRawMaterialCategory } from '@/lib/raw-materials'

export async function POST(request: NextRequest) {
  try {
    const user = await requireActiveAuth()
    if (!['ADMIN', 'MANAGER', 'OPERATOR', 'WAREHOUSE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const db = getTenantPrisma(user.organizationId)
    const body = await request.json()
    const { materialName, diameter, length, width, height, kgReceived, supplierId, reference } = body
    const piecesReceived = Number(body.piecesReceived)
    const category = normalizeRawMaterialCategory(body.category)

    // Validate required fields
    if (!materialName || !diameter || !length || !width || !height || !kgReceived || !body.piecesReceived) {
      return NextResponse.json(
        { error: 'Missing required fields: materialName, diameter, length, width/diameter, height, kgReceived, piecesReceived' },
        { status: 400 }
      )
    }

    // Validate kgReceived
    if (kgReceived <= 0) {
      return NextResponse.json(
        { error: 'kgReceived must be greater than 0' },
        { status: 400 }
      )
    }
    if (!Number.isInteger(piecesReceived) || piecesReceived <= 0) {
      return NextResponse.json(
        { error: 'piecesReceived must be a positive whole number' },
        { status: 400 }
      )
    }

    // Check if material already exists
    const existingMaterial = await db.rawMaterial.findFirst({
      where: {
        materialName,
        category,
        diameter,
        length,
        width,
        height,
      },
    })

    let material
    await db.$transaction(async (tx) => {
      if (existingMaterial) {
        // Update existing material
        material = await tx.rawMaterial.update({
          where: { id: existingMaterial.id },
          data: {
            availableKg: { increment: kgReceived },
            availablePieces: { increment: piecesReceived },
            supplierId,
            updatedAt: new Date(),
          },
        })
      } else {
        // Create new material
        const sku = `${materialName.replace(/\s+/g, '-').toUpperCase()}-${diameter.toUpperCase()}-${Date.now().toString().slice(-6)}`;
        material = await tx.rawMaterial.create({
          data: {
            organizationId: user.organizationId,
            sku,
            materialName,
            category,
            diameter,
            length,
            width,
            height,
            availableKg: kgReceived,
            availablePieces: piecesReceived,
            supplierId,
          },
        })
      }

      await tx.materialReceipt.create({
        data: {
          organizationId: user.organizationId,
          materialId: material.id,
          kgReceived,
          piecesReceived,
          supplierId,
          reference: reference || null,
        },
      })
    })

    return NextResponse.json(
      {
        message: existingMaterial ? 'Material updated successfully' : 'Material added successfully',
        material,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error adding raw material:', error)
    return NextResponse.json(
      { error: 'Failed to add raw material' },
      { status: 500 }
    )
  }
}
