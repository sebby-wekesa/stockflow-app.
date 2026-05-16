"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Schema for material consumption validation
const materialConsumptionSchema = z.object({
  productionOrderId: z.string(),
  bomItems: z.array(z.object({
    rawMaterialId: z.string(),
    quantity: z.number().positive(),
    unitOfMeasure: z.string().default("kg")
  }))
});

export async function consumeMaterialsForOrder(productionOrderId: string) {
  const user = await requireAuth();

  // Get the production order with BOM information
  const order = await prisma.productionOrder.findUnique({
    where: { id: productionOrderId },
    include: {
      design: {
        include: {
          billOfMaterials: {
            include: {
              RawMaterial: true
            }
          }
        }
      }
    }
  });

  if (!order) {
    throw new Error("Production order not found");
  }

  if (order.design.billOfMaterials.length === 0) {
    throw new Error("No BOM items found for this design");
  }

  // Calculate required quantities
  const consumptionData = order.design.billOfMaterials.map(bomItem => ({
    rawMaterialId: bomItem.rawMaterialId,
    quantity: Number(bomItem.quantity) * order.quantity,
    unitOfMeasure: bomItem.unitOfMeasure
  }));

  // Validate the consumption data
  materialConsumptionSchema.parse({ productionOrderId, bomItems: consumptionData });

  // Use transaction for atomic material consumption
  return await prisma.$transaction(async (tx) => {
    const consumptionLogs = [];

    for (const item of consumptionData) {
      // Check if sufficient stock is available
      const material = await tx.rawMaterial.findUnique({
        where: { id: item.rawMaterialId }
      });

      if (!material) {
        throw new Error(`Material ${item.rawMaterialId} not found`);
      }

      if (Number(material.availableKg) < item.quantity) {
        throw new Error(
          `Insufficient stock for ${material.materialName}. Available: ${material.availableKg}${item.unitOfMeasure}, Required: ${item.quantity}${item.unitOfMeasure}`
        );
      }

      // Deduct from available stock
      await tx.rawMaterial.update({
        where: { id: item.rawMaterialId },
        data: {
          availableKg: { decrement: item.quantity }
        }
      });

      // Create consumption log
      const log = await tx.materialConsumptionLog.create({
        data: {
          productionOrderId,
          rawMaterialId: item.rawMaterialId,
          quantityConsumed: item.quantity,
          notes: "Auto-consumed on order release"
        }
      });

      consumptionLogs.push(log);
    }

    return {
      success: true,
      consumptionLogs,
      totalConsumed: consumptionData.reduce((sum, item) => sum + item.quantity, 0)
    };
  });
}

export async function getMaterialConsumptionLogs(orderId: string) {
  const user = await requireAuth();

  const logs = await prisma.materialConsumptionLog.findMany({
    where: { productionOrderId: orderId },
    include: {
      RawMaterial: true,
      ProductionOrder: {
        include: {
          design: true
        }
      }
    },
    orderBy: { consumedAt: 'desc' }
  });

  return logs.map(log => ({
    id: log.id,
    materialName: log.RawMaterial.materialName,
    quantityConsumed: Number(log.quantityConsumed),
    unitOfMeasure: log.RawMaterial.diameter ? 'kg' : 'pcs', // Simplified unit detection
    consumedAt: log.consumedAt,
    notes: log.notes
  }));
}