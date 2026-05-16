"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, getUser } from "@/lib/auth";
import { productionOrderSchema, ProductionOrderInput } from "@/lib/validations";
import type { PrismaClient } from "@prisma/client";
type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export async function createProductionOrder(formData: FormData) {
  await requireRole("ADMIN");

  const designId = formData.get("designId") as string;
  const quantity = parseInt(formData.get("quantity") as string);
  const targetKg = parseFloat(formData.get("targetKg") as string);

  // Generate order number (ORD-YYYY-NNNN)
  const currentYear = new Date().getFullYear();
  const lastOrder = await prisma.productionOrder.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });

  let nextNumber = 1;
  if (lastOrder?.orderNumber) {
    const match = lastOrder.orderNumber.match(/ORD-\d{4}-(\d{4})/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  const orderNumber = `ORD-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;

  const input: ProductionOrderInput = {
    designId,
    quantity,
    targetKg,
    orderNumber,
  };

  productionOrderSchema.parse(input);

  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });

  if (!design) {
    throw new Error("Design not found");
  }

  if (design.stages.length === 0) {
    throw new Error("Design must have at least one stage");
  }
  const initialStage = design.stages[0];

  const order = await prisma.productionOrder.create({
    data: {
      orderNumber: input.orderNumber,
      designId: input.designId,
      quantity: input.quantity,
      targetKg: input.targetKg,
      status: "PENDING",
      currentStage: initialStage.sequence,
    },
  });

  redirect("/orders");
}

export async function approveProductionOrder(orderId: string) {
  await requireRole("ADMIN");

  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      design: {
        include: {
          billOfMaterials: {
            include: {
              RawMaterial: true
            }
          }
        }
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "PENDING") {
    throw new Error("Order is not pending approval");
  }

  if (order.design.billOfMaterials.length === 0) {
    throw new Error("Design does not have BOM items configured");
  }

  // Perform the transaction to approve order and consume materials
  await prisma.$transaction(async (tx: TransactionClient) => {
    // 1. Consume materials from BOM
    const consumptionLogs = [];

    for (const bomItem of order.design.billOfMaterials) {
      const requiredQuantity = Number(bomItem.quantity) * order.quantity;

      // Check if sufficient stock is available
      const material = await tx.rawMaterial.findUnique({
        where: { id: bomItem.rawMaterialId }
      });

      if (!material) {
        throw new Error(`Material ${bomItem.rawMaterialId} not found`);
      }

      if (Number(material.availableKg) < requiredQuantity) {
        throw new Error(
          `Insufficient stock for ${material.materialName}. Available: ${material.availableKg}${bomItem.unitOfMeasure}, Required: ${requiredQuantity}${bomItem.unitOfMeasure}`
        );
      }

      // Deduct from available stock
      await tx.rawMaterial.update({
        where: { id: bomItem.rawMaterialId },
        data: {
          availableKg: { decrement: requiredQuantity }
        }
      });

      // Create consumption log
      const log = await tx.materialConsumptionLog.create({
        data: {
          id: crypto.randomUUID(),
          productionOrderId: orderId,
          rawMaterialId: bomItem.rawMaterialId,
          quantityConsumed: requiredQuantity,
          notes: "Auto-consumed on order approval"
        }
      });

      consumptionLogs.push(log);
    }

    // 2. Update the Order Status to APPROVED
    await tx.productionOrder.update({
      where: { id: orderId },
      data: {
        status: "APPROVED",
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    });
  });

  redirect("/approvals");
}

export async function releaseProductionOrder(orderId: string) {
  await requireRole("ADMIN");

  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      design: {
        include: {
          stages: {
            orderBy: { sequence: "asc" }
          }
        }
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "APPROVED") {
    throw new Error("Order must be approved before release to production");
  }

  if (order.design.stages.length === 0) {
    throw new Error("Design must have at least one production stage");
  }

  const firstStage = order.design.stages[0];

  // Update order to IN_PRODUCTION status and set initial stage
  await prisma.productionOrder.update({
    where: { id: orderId },
    data: {
      status: "IN_PRODUCTION",
      currentStage: firstStage.sequence,
      currentDept: firstStage.department
    },
  });

  redirect("/production");
}

export async function rejectProductionOrder(orderId: string) {
  await requireRole("ADMIN");

  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "PENDING") {
    throw new Error("Order is not pending approval");
  }

  await prisma.productionOrder.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });

  redirect("/approvals");
}