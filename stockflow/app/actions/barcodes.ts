"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";

// Generate unique barcode for raw material batch
export async function generateRawMaterialBarcode(materialId: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  if (user.role !== 'ADMIN' && user.role !== 'WAREHOUSE') {
    throw new Error('Unauthorized: Only admins and warehouse staff can generate barcodes');
  }

  const material = await db.rawMaterial.findUnique({
    where: { id: materialId }
  });

  if (!material) {
    throw new Error('Raw material not found');
  }

  // Generate unique barcode: RM-{MATERIAL_CODE}-{TIMESTAMP}-{RANDOM}
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const barcode = `RM-${material.materialName.replace(/\s+/g, '').toUpperCase().slice(0, 3)}-${timestamp}-${random}`;

  // Check if barcode already exists (very unlikely but good practice)
  const existing = await db.rawMaterial.findUnique({
    where: { organizationId_barcode: { organizationId: user.organizationId, barcode } }
  });

  if (existing) {
    throw new Error('Barcode collision detected, please try again');
  }

  // Update material with barcode
  const updatedMaterial = await db.rawMaterial.update({
    where: { id: materialId },
    data: {
      barcode,
      batchNumber: `BATCH-${timestamp}-${random}`
    }
  });

  return {
    barcode,
    batchNumber: updatedMaterial.batchNumber,
    material: updatedMaterial
  };
}

// Generate unique barcode for finished goods
export async function generateFinishedGoodsBarcode(finishedGoodsId: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  if (user.role !== 'ADMIN' && user.role !== 'PACKAGING') {
    throw new Error('Unauthorized: Only admins and packaging staff can generate finished goods barcodes');
  }

  const finishedGoods = await db.finishedGoods.findUnique({
    where: { id: finishedGoodsId },
    include: { design: true }
  });

  if (!finishedGoods) {
    throw new Error('Finished goods not found');
  }

  // Generate unique barcode: FG-{DESIGN_CODE}-{QUANTITY}-{TIMESTAMP}
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const barcode = `FG-${finishedGoods.design.code}-${finishedGoods.quantity}-${timestamp}-${random}`;

  // Check if barcode already exists
  const existing = await db.finishedGoods.findUnique({
    where: { organizationId_barcode: { organizationId: user.organizationId, barcode } }
  });

  if (existing) {
    throw new Error('Barcode collision detected, please try again');
  }

  // Update finished goods with barcode
  const updatedFinishedGoods = await db.finishedGoods.update({
    where: { id: finishedGoodsId },
    data: {
      barcode,
      batchNumber: `PROD-${timestamp}-${random}`
    }
  });

  return {
    barcode,
    batchNumber: updatedFinishedGoods.batchNumber,
    finishedGoods: updatedFinishedGoods
  };
}

// Get barcode data for printing
export async function getBarcodeData(barcode: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Try raw material first (tenant-scoped)
  const rawMaterial = await db.rawMaterial.findUnique({
    where: {
      organizationId_barcode: {
        organizationId: user.organizationId,
        barcode,
      },
    },
    include: { Supplier: true },
  });

  if (rawMaterial) {
    return {
      type: 'raw_material' as const,
      barcode,
      batchNumber: rawMaterial.batchNumber,
      name: rawMaterial.materialName,
      details: `${rawMaterial.diameter} - ${rawMaterial.availableKg}kg / ${rawMaterial.availablePieces} pcs available`,
      supplier: rawMaterial.Supplier?.name || 'Unknown',
      createdAt: rawMaterial.createdAt,
    };
  }

  // Try finished goods (tenant-scoped)
  const finishedGood = await db.finishedGoods.findUnique({
    where: {
      organizationId_barcode: {
        organizationId: user.organizationId,
        barcode,
      },
    },
    include: { design: true },
  });

  if (finishedGood) {
    return {
      type: 'finished_goods' as const,
      barcode,
      batchNumber: finishedGood.batchNumber,
      name: finishedGood.design.name,
      details: `${finishedGood.quantity} units - ${finishedGood.kgProduced}kg produced`,
      designCode: finishedGood.design.code,
      createdAt: finishedGood.createdAt,
    };
  }

  throw new Error('Barcode not found');
}
