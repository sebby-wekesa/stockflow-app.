// lib/actions/customer.ts
import { prisma } from "@/lib/prisma";

export async function getOrderProgress(orderId: string) {
  try {
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
        logs: {
          orderBy: { sequence: "desc" },
          take: 10
        }
      },
    });

    if (!order) {
      return null;
    }

    const totalStages = order.design.stages.length;
    const completedStages = order.logs.length;
    const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

    // Build stages array for the UI
    const stages = order.design.stages.map((stage, index) => {
      const stageLog = order.logs.find(log => log.sequence === stage.sequence);
      const isCompleted = !!stageLog;
      const isCurrent = order.currentStage === stage.sequence && !isCompleted;

      return {
        name: stage.name,
        isCompleted,
        isCurrent
      };
    });

    return {
      orderNumber: order.orderNumber,
      product: order.design.name,
      status: order.status,
      progress,
      stages,
      lastUpdate: order.updatedAt
    };
  } catch (error) {
    console.error("Failed to fetch order progress:", error);
    return null;
  }
}