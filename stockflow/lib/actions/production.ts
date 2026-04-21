"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { StageLogSchema } from "@/lib/schemas/production";
import { requireRole } from "@/lib/auth";

export async function completeStage(data: any) {
  try {
    await requireRole("OPERATOR", "ADMIN");

    const validated = StageLogSchema.parse(data);

    // Find the order and get current stage
    const order = await prisma.productionOrder.findUnique({
      where: { id: validated.orderId },
      include: {
        design: { include: { stages: true } },
        logs: { orderBy: { sequence: "desc" }, take: 1 },
      },
    });

    if (!order) {
      return { error: "Production order not found" };
    }

    if (order.status !== "APPROVED" && order.status !== "IN_PRODUCTION") {
      return { error: "Order must be approved or in production" };
    }

    const expectedSequence = order.logs.length > 0 ? order.logs[0].sequence + 1 : 1;
    const currentStage = order.design.stages.find(s => s.sequence === expectedSequence);

    if (!currentStage) {
      return { error: "No current stage found" };
    }

    const stageLog = await prisma.stageLog.create({
      data: {
        orderId: validated.orderId,
        stageId: currentStage.id,
        stageName: currentStage.name,
        department: currentStage.department,
        sequence: expectedSequence,
        kgIn: validated.kgIn,
        kgOut: validated.kgOut,
        kgScrap: validated.kgScrap,
        operatorId: validated.operatorId,
        notes: validated.notes,
      },
    });

    const isLastStage = expectedSequence === order.design.stages.length;
    const newStatus = isLastStage ? "COMPLETED" : "IN_PRODUCTION";
    const nextStage = isLastStage ? null : expectedSequence + 1;

    await prisma.productionOrder.update({
      where: { id: validated.orderId },
      data: {
        status: newStatus,
        ...(nextStage && { currentStage: nextStage }),
      },
    });

    // Create FinishedGood if order is completed
    if (isLastStage) {
      const quantity = Math.floor(validated.kgOut / order.design.kgPerUnit);
      await prisma.finishedGood.create({
        data: {
          designId: order.designId,
          productionOrderId: validated.orderId,
          quantity,
        },
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/jobs");

    return { success: true, stageLog, newStatus };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "An error occurred" };
  }
}