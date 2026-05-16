"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function getRawMaterials() {
  const user = await requireAuth();

  // All authenticated users can view raw materials
  return await prisma.rawMaterial.findMany({
    include: {
      supplier: true,
      receipts: {
        orderBy: { createdAt: 'desc' },
        take: 1 // Get latest receipt for stock info
      }
    },
    orderBy: { materialName: 'asc' }
  });
}

export async function getRawMaterial(id: string) {
  const user = await requireAuth();

  const material = await prisma.rawMaterial.findUnique({
    where: { id },
    include: {
      supplier: true,
      receipts: {
        orderBy: { createdAt: 'desc' }
      },
      bomItems: {
        include: {
          Design: true
        }
      }
    }
  });

  if (!material) {
    throw new Error('Raw material not found');
  }

  return material;
}

export async function createRawMaterial(data: {
  materialName: string;
  diameter: string;
  supplierId?: string;
}) {
  const user = await requireAuth();

  // Only admins and managers can create raw materials
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'WAREHOUSE') {
    throw new Error('Unauthorized: Insufficient permissions');
  }

  // Generate SKU: MATERIAL-DIAMETER-TIMESTAMP
  const sku = `${data.materialName.replace(/\s+/g, '-').toUpperCase()}-${data.diameter.toUpperCase()}-${Date.now().toString().slice(-6)}`;

  return await prisma.rawMaterial.create({
    data: {
      sku,
      materialName: data.materialName,
      diameter: data.diameter,
      supplierId: data.supplierId || null
    }
  });
}

export async function updateRawMaterialStock(id: string, kgReceived: number, reference?: string, supplierId?: string) {
  const user = await requireAuth();

  // Only warehouse staff, admins, and managers can update stock
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'WAREHOUSE') {
    throw new Error('Unauthorized: Only warehouse staff can update material stock');
  }

  return await prisma.$transaction(async (tx) => {
    // Create receipt record
    await tx.materialReceipt.create({
      data: {
        materialId: id,
        kgReceived,
        reference,
        supplierId,
        loggedBy: user.id
      }
    });

    // Update available stock
    const material = await tx.rawMaterial.update({
      where: { id },
      data: {
        availableKg: {
          increment: kgReceived
        }
      }
    });

    return material;
  });
}