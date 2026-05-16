"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Generate unique barcode for raw material batch
export async function generateRawMaterialBarcode(materialId: string) {
  const user = await requireAuth();

  if (user.role !== 'ADMIN' && user.role !== 'WAREHOUSE') {
    throw new Error('Unauthorized: Only admins and warehouse staff can generate barcodes');
  }

  const material = await prisma.rawMaterial.findUnique({
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
  const existing = await prisma.rawMaterial.findUnique({
    where: { barcode }
  });

  if (existing) {
    throw new Error('Barcode collision detected, please try again');
  }

  // Update material with barcode
  const updatedMaterial = await prisma.rawMaterial.update({
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
  const user = await requireAuth();

  if (user.role !== 'ADMIN' && user.role !== 'PACKAGING') {
    throw new Error('Unauthorized: Only admins and packaging staff can generate finished goods barcodes');
  }

  const finishedGoods = await prisma.finishedGoods.findUnique({
    where: { id: finishedGoodsId },
    include: { Design: true }
  });

  if (!finishedGoods) {
    throw new Error('Finished goods not found');
  }

  // Generate unique barcode: FG-{DESIGN_CODE}-{QUANTITY}-{TIMESTAMP}
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const barcode = `FG-${finishedGoods.design.code}-${finishedGoods.quantity}-${timestamp}-${random}`;

  // Check if barcode already exists
  const existing = await prisma.finishedGoods.findUnique({
    where: { barcode }
  });

  if (existing) {
    throw new Error('Barcode collision detected, please try again');
  }

  // Update finished goods with barcode
  const updatedFinishedGoods = await prisma.finishedGoods.update({
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
  const user = await requireAuth();

  // Define a union type that encompasses both potential database results
  let item:
    | (Awaited<ReturnType<typeof prisma.rawMaterial.findUnique>> & { supplier: any })
    | (Awaited<ReturnType<typeof prisma.finishedGoods.findUnique>> & { design: any })
    | null = null;

  // Try raw material first
  item = await prisma.rawMaterial.findUnique({
    where: { barcode },
    include: { supplier: true }
  });

  if (item) {
    return {
      type: 'raw_material',
      barcode,
      batchNumber: item.batchNumber,
      name: item.materialName,
      details: `${item.diameter} - ${item.availableKg}kg available`,
      supplier: item.supplier?.name || 'Unknown',
      createdAt: item.createdAt
    };
  }

  // Try finished goods
  item = await prisma.finishedGoods.findUnique({
    where: { barcode },
    include: { Design: true }
  });

  if (item) {
    return {
      type: 'finished_goods',
      barcode,
      batchNumber: item.batchNumber,
      name: item.design.name,
      details: `${item.quantity} units - ${item.kgProduced}kg produced`,
      designCode: item.design.code,
      createdAt: item.createdAt
    };
  }

  throw new Error('Barcode not found');
}