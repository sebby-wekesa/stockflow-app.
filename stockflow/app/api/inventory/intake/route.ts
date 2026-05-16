export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { materialName, diameter, kgReceived, supplierId } = body

    // Validate required fields
    if (!materialName || !diameter || !kgReceived) {
      return NextResponse.json(
        { error: 'Missing required fields: materialName, diameter, kgReceived' },
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

    // Check if material already exists
    const existingMaterial = await prisma.rawMaterial.findFirst({
      where: {
        materialName,
        diameter,
      },
    })

    let material
    if (existingMaterial) {
      // Update existing material
      material = await prisma.rawMaterial.update({
        where: { id: existingMaterial.id },
        data: {
          availableKg: existingMaterial.availableKg + kgReceived,
          supplierId,
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new material
      const sku = `${materialName.replace(/\s+/g, '-').toUpperCase()}-${diameter.toUpperCase()}-${Date.now().toString().slice(-6)}`;
      material = await prisma.rawMaterial.create({
        data: {
          sku,
          materialName,
          diameter,
          availableKg: kgReceived,
          supplierId,
        },
      })
    }

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