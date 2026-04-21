// lib/actions/customer.ts
"use server";

import { prisma } from "@/lib/prisma";

export async function getOrderProgress(trackingNumber: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { orderNumber: trackingNumber },
    include: {
      design: {
        include: {
          stages: { orderBy: { sequence: 'asc' } }
        }
      }
    }
  });

  if (!order) return null;

  const totalStages = order.design.stages.length;
  const currentStageIdx = order.currentStage || 0;
  const progressPercent = Math.round((currentStageIdx / totalStages) * 100);

  return {
    orderNumber: order.orderNumber,
    product: order.design.name,
    status: order.status,
    progress: progressPercent,
    currentDept: order.currentDept,
    lastUpdate: order.updatedAt,
    stages: order.design.stages.map(s => ({
      name: s.name,
      isCompleted: s.sequence < currentStageIdx,
      isCurrent: s.sequence === currentStageIdx
    }))
  };
}