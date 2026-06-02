"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { type RawMaterialCategory, normalizeRawMaterialCategory } from "@/lib/raw-materials";

export async function getRawMaterials() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // All authenticated users can view raw materials (tenant scoped)
  return await db.rawMaterial.findMany({
    include: {
      Supplier: true,
      MaterialReceipt: {
        orderBy: { createdAt: 'desc' },
        take: 1 // Get latest receipt for stock info
      }
    },
    orderBy: { materialName: 'asc' }
  });
}

export async function getRawMaterial(id: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const material = await db.rawMaterial.findUnique({
    where: { id },
    include: {
      Supplier: true,
      MaterialReceipt: {
        orderBy: { createdAt: 'desc' }
      },
      BillOfMaterials: {
        include: {
          design: true
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
  category?: RawMaterialCategory;
  diameter: string;
  length: string;
  width: string;
  height: string;
  availablePieces?: number;
  supplierId?: string;
}) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Only admins and managers can create raw materials
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'WAREHOUSE') {
    throw new Error('Unauthorized: Insufficient permissions');
  }

  // Generate SKU: MATERIAL-DIAMETER-TIMESTAMP
  const sku = `${data.materialName.replace(/\s+/g, '-').toUpperCase()}-${data.diameter.toUpperCase()}-${Date.now().toString().slice(-6)}`;

  return await db.rawMaterial.create({
    data: {
      organizationId: user.organizationId,
      sku,
      materialName: data.materialName,
      category: normalizeRawMaterialCategory(data.category),
      diameter: data.diameter,
      length: data.length,
      width: data.width,
      height: data.height,
      availablePieces: data.availablePieces ?? 0,
      supplierId: data.supplierId || null
    }
  });
}

export async function updateRawMaterialStock(id: string, kgReceived: number, reference?: string, supplierId?: string, piecesReceived = 0) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Only warehouse staff, admins, and managers can update stock
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'WAREHOUSE') {
    throw new Error('Unauthorized: Only warehouse staff can update material stock');
  }

  return await db.$transaction(async (tx) => {
    // Create receipt record
    await tx.materialReceipt.create({
      data: {
        organizationId: user.organizationId,
        materialId: id,
        kgReceived,
        piecesReceived,
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
        },
        availablePieces: {
          increment: piecesReceived
        },
      }
    });

    return material;
  });
}
