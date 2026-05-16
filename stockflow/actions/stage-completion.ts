"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { stageCompletionSchema, StageCompletionInput } from "@/lib/validations";
import { requireRole } from "@/lib/auth";

export async function completeStage(input: StageCompletionInput) {
  await requireRole("OPERATOR", "ADMIN");

  const validated = stageCompletionSchema.parse(input);

  // Use database transaction for atomicity
  return await prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findUnique({
      where: { id: validated.orderId },
      include: {
        design: { include: { stages: true } },
        StageLog: { orderBy: { sequence: "desc" }, take: 1 },
      },
    });

    if (!order) {
      throw new Error("Production order not found");
    }

    if (order.status !== "APPROVED" && order.status !== "IN_PRODUCTION") {
      throw new Error("Order must be approved or in production");
    }

    const currentStageIndex = order.design.stages.findIndex(
      (s) => s.sequence === validated.sequence
    );

    if (currentStageIndex === -1) {
      throw new Error("Invalid stage sequence");
    }

    const expectedSequence = order.logs.length > 0 ? order.logs[0].sequence + 1 : 1;
    if (validated.sequence !== expectedSequence) {
      throw new Error(`Must complete stages in order. Expected sequence ${expectedSequence}, got ${validated.sequence}`);
    }

    const stage = order.design.stages[currentStageIndex];

    if (!stage) {
      throw new Error("Stage not found for the given sequence");
    }

    // Create the stage log
    const stageLog = await tx.stageLog.create({
      data: {
        orderId: validated.orderId,
        stageId: stage.id,
        stageName: validated.stageName,
        department: stage.department,
        sequence: validated.sequence,
        kgIn: validated.kgIn,
        kgOut: validated.kgOut,
        kgScrap: validated.kgScrap,
        operatorId: validated.operatorId,
        notes: validated.notes,
      },
    });

    const isLastStage = currentStageIndex === order.design.stages.length - 1;
    const newStatus = isLastStage ? "COMPLETED" : "IN_PRODUCTION";
    const nextStage = isLastStage ? null : order.design.stages[currentStageIndex + 1].sequence;

    // Update production order status and stage
    await tx.productionOrder.update({
      where: { id: validated.orderId },
      data: {
        status: newStatus,
        ...(nextStage !== null && { currentStage: nextStage }),
        ...(isLastStage && { completedAt: new Date() }),
      },
    });

    // If this is the last stage, create finished goods
    if (isLastStage) {
      // Generate SKU (FG-YYYY-NNNN)
      const currentYear = new Date().getFullYear();
      const lastFinishedGoods = await tx.finishedGoods.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { sku: true },
      });

      let nextNumber = 1;
      if (lastFinishedGoods?.sku) {
        const match = lastFinishedGoods.sku.match(/FG-\d{4}-(\d{4})/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const sku = `FG-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;

      await tx.finishedGoods.create({
        data: {
          sku,
          designId: order.designId,
          quantity: order.quantity,
          kgProduced: validated.kgOut,
        },
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/jobs");

    return { success: true, stageLog, newStatus, orderCompleted: isLastStage };
  });
}