"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { StageLogSchema } from "@/lib/schemas/production";
import { requireRole } from "@/lib/auth";

export async function completeStage(formData: {
  orderId: string;
  kgIn: number;
  kgOut: number;
  kgScrap: number;
  scrapReason?: string;
  notes?: string;
}) {
  // Get authenticated operator
  const user = await requireRole('OPERATOR', 'ADMIN');
  // 1. Validate Input using the "Key Rule" logic
  const validatedFields = StageLogSchema.safeParse(formData);

  if (!validatedFields.success) {
    return { error: "Validation Failed: Kg In must equal Out + Scrap." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 2. Fetch current order and the next stage in sequence [cite: 68, 101]
      const order = await tx.productionOrder.findUnique({
        where: { id: formData.orderId },
        include: {
          design: {
            include: { stages: { orderBy: { sequence: 'asc' } } }
          }
        }
      });

      if (!order) throw new Error("Order not found.");

      const currentStageIndex = order.design.stages.findIndex(
        (s) => s.sequence === order.currentStage
      );
      const nextStage = order.design.stages[currentStageIndex + 1];

      // 3. Create the Traceability Log [cite: 77, 141]
      await tx.stageLog.create({
        data: {
          orderId: formData.orderId,
          stageName: order.design.stages[currentStageIndex].name,
          sequence: order.currentStage,
          kgIn: formData.kgIn,
          kgOut: formData.kgOut,
          kgScrap: formData.kgScrap,
          scrapReason: formData.scrapReason,
          operatorId: user.id,
          notes: formData.notes,
          department: order.currentDept,
        },
      });

      // 4. Update Order Status and Routing
      if (nextStage) {
        // Move to next department queue [cite: 104, 105]
        await tx.productionOrder.update({
          where: { id: formData.orderId },
          data: {
            currentStage: nextStage.sequence,
            currentDept: nextStage.department,
            status: "IN_PRODUCTION",
          },
        });
      } else {
        // No more stages -> Move to Finished Goods [cite: 48, 86]
        await tx.productionOrder.update({
          where: { id: formData.orderId },
          data: {
            status: "COMPLETED",
            currentDept: "FINISHED_GOODS"
          },
        });

        await tx.finishedGood.create({
          data: {
            designId: order.designId,
            productionOrderId: order.id,
            quantity: Math.floor(formData.kgOut / (order.design.kgPerUnit || 1)), // Estimated units [cite: 29]
          },
        });
      }

      revalidatePath("/dashboard/operator");
      return { success: true };
    });
  } catch (error) {
    console.error("Stage Completion Error:", error);
    return { error: "Failed to complete stage. Please try again." };
  }
}