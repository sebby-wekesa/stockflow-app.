// lib/actions/orders.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createProductionOrder(data: {
  designId: string;
  targetKg: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}) {
  try {
    const order = await prisma.productionOrder.create({
      data: {
        orderNumber: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
        designId: data.designId,
        targetKg: data.targetKg,
        priority: data.priority,
        status: "PENDING",
      },
    });

    revalidatePath("/dashboard/manager/orders");
    return { success: true, orderId: order.id };
  } catch (error) {
    return { error: "Failed to create order." };
  }
}

export async function approveAndReleaseOrder(orderId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Get the order and the first stage of the design
      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
        include: { design: { include: { stages: { orderBy: { sequence: 'asc' } } } } }
      });

      if (!order || order.design.stages.length === 0) throw new Error("Invalid design.");

      const firstStage = order.design.stages[0];

      // 2. Update order to Approved and route to first department
      await tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: "APPROVED",
          currentStage: firstStage.sequence,
          currentDept: firstStage.department,
        },
      });

      // 3. Move status to IN_PRODUCTION as it hits the first queue
      await tx.productionOrder.update({
        where: { id: orderId },
        data: { status: "IN_PRODUCTION" }
      });

      return { success: true };
    });
  } catch (error) {
    return { error: "Approval failed." };
  }
}