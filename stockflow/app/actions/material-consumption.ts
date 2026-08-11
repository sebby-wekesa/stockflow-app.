"use server";

import { revalidatePath } from "next/cache";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
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

const manualConsumptionSchema = z.object({
  jobCardNo: z.string().trim().min(1, "Job card number is required"),
  rawMaterialId: z.string().min(1, "Raw material is required"),
  consumedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  piecesCut: z.coerce.number().finite().int().positive("Pieces cut must be a positive whole number"),
  weightPerPiece: z.coerce.number().finite().positive("Weight per piece must be positive"),
  totalWeightCut: z.coerce.number().finite().positive("Total weight cut must be positive"),
});

export async function recordManualMaterialConsumption(formData: FormData) {
  const user = await requireActiveAuth();
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    throw new Error('Only admins and managers can record raw material consumption');
  }

  const parsed = manualConsumptionSchema.safeParse({
    jobCardNo: formData.get('jobCardNo'),
    rawMaterialId: formData.get('rawMaterialId'),
    consumedAt: formData.get('consumedAt'),
    piecesCut: formData.get('piecesCut'),
    weightPerPiece: formData.get('weightPerPiece'),
    totalWeightCut: formData.get('totalWeightCut'),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const data = parsed.data;
  const consumedAt = new Date(`${data.consumedAt}T00:00:00.000Z`);
  if (Number.isNaN(consumedAt.getTime()) || consumedAt.toISOString().slice(0, 10) !== data.consumedAt) {
    throw new Error('Enter a valid date');
  }

  const expectedTotal = data.piecesCut * data.weightPerPiece;
  if (Math.abs(expectedTotal - data.totalWeightCut) > 0.01) {
    throw new Error('Total weight cut must equal pieces cut multiplied by weight per piece');
  }

  const db = getTenantPrisma(user.organizationId);
  const [order, material] = await Promise.all([
    db.productionOrder.findFirst({
      where: { orderNumber: data.jobCardNo },
      select: { id: true, orderNumber: true, status: true },
    }),
    db.rawMaterial.findFirst({
      where: { id: data.rawMaterialId },
      select: { id: true, materialName: true, availableKg: true, availablePieces: true },
    }),
  ]);

  if (!order) throw new Error(`Job card "${data.jobCardNo}" not found`);
  if (!['APPROVED', 'IN_PRODUCTION', 'COMPLETED'].includes(order.status)) {
    throw new Error('Raw material can only be recorded for an approved or active job card');
  }
  if (!material) throw new Error('Raw material not found');

  await withTenantTransaction(user.organizationId, async (tx) => {
    const stockUpdate = await tx.rawMaterial.updateMany({
      where: {
        id: material.id,
        availableKg: { gte: data.totalWeightCut },
        availablePieces: { gte: data.piecesCut },
      },
      data: {
        availableKg: { decrement: data.totalWeightCut },
        availablePieces: { decrement: data.piecesCut },
      },
    });

    if (stockUpdate.count === 0) {
      throw new Error(
        `Insufficient stock for ${material.materialName}. Required: ${data.totalWeightCut} kg and ${data.piecesCut} pieces`,
      );
    }

    await tx.materialConsumptionLog.create({
      data: {
        productionOrderId: order.id,
        rawMaterialId: material.id,
        quantityConsumed: data.totalWeightCut,
        piecesCut: data.piecesCut,
        weightPerPiece: data.weightPerPiece,
        consumedAt,
        notes: `Manually recorded by ${user.email}`,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'RAW_MATERIAL_CONSUMPTION_RECORDED',
        entityType: 'MaterialConsumptionLog',
        entityId: order.id,
        details: JSON.stringify({
          orderNumber: order.orderNumber,
          rawMaterialId: material.id,
          piecesCut: data.piecesCut,
          weightPerPiece: data.weightPerPiece,
          totalWeightCut: data.totalWeightCut,
        }),
      },
    });
  }, { maxWait: 10000, timeout: 30000 });

  revalidatePath('/raw-material-consumption');
  revalidatePath('/rawmaterials');
}

export async function consumeMaterialsForOrder(productionOrderId: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Get the production order with BOM information (tenant scoped)
  const order = await db.productionOrder.findUnique({
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

  if (!order.design) {
    throw new Error("Direct orders consume material when production output is recorded");
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

  // Use tenant-scoped transaction for atomic material consumption
  return await db.$transaction(async (tx) => {
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
          organizationId: user.organizationId,
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
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const logs = await db.materialConsumptionLog.findMany({
    where: { 
      productionOrderId: orderId,
      organizationId: user.organizationId 
    },
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
