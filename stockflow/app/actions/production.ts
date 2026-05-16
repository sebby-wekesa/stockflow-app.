"use server";

import { revalidatePath } from 'next/cache';
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function getOperatorQueue(role?: string, department?: string) {
  const user = await requireAuth();
  const effectiveRole = role || user.role;
  const effectiveDept = department || user.department;

  // If user is ADMIN or MANAGER, they see all queues.
  // If OPERATOR, they see their department's queue.
  let orders: any[] = []
  try {
    orders = await prisma.productionOrder.findMany({
      where: {
        status: "IN_PRODUCTION",
        ...(effectiveRole === "OPERATOR" && effectiveDept ? { currentDept: effectiveDept } : {}),
        ...(effectiveRole !== "ADMIN" && user.branchId ? { branchId: user.branchId } : {}),
      },
      include: {
        design: {
          include: {
            stages: true,
          },
        },
      },
      orderBy: {
        priority: "desc",
      },
    });
  } catch (error) {
    console.warn('Failed to fetch operator queue:', error)
    orders = []
  }

  return orders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    designName: o.design.name,
    currentStage: o.currentStage,
    totalStages: o.design.stages.length,
    priority: o.priority,
    targetKg: o.targetKg,
    // Add logic to get the current stage target dims or specific work
    workDescription: o.design.stages.find((s: { sequence: number; name: string }) => s.sequence === o.currentStage)?.name || "Production",
    inheritedKg: o.targetKg, // Simplified for now
  }));
}

export async function getOperatorHistory() {
  const user = await requireAuth();

  let logs: any[] = []
  try {
    logs = await prisma.stageLog.findMany({
      where: {
        operatorId: user.id,
      },
      include: {
        ProductionOrder: {
          include: {
            Design: true,
        },
      },
    },
    orderBy: {
      completedAt: "desc",
    },
    take: 20, // Last 20 completed jobs
  });
  } catch (error) {
    console.warn('Failed to fetch operator history:', error)
    logs = []
  }

  return logs.map(log => ({
    id: log.id,
    orderNumber: log.ProductionOrder.orderNumber,
    designName: log.ProductionOrder.design.name,
    completedAt: log.completedAt,
    kgOut: log.kgOut,
    kgScrap: log.kgScrap,
    department: log.department,
    stageName: log.stageName,
  }));
}

export async function getOrderForLogging(id: string) {
  let order
  try {
    order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        design: {
          include: {
            stages: {
              orderBy: {
                sequence: "asc",
              },
            },
          },
        },
        logs: {
          orderBy: {
            sequence: "desc",
          },
          take: 1,
        },
      },
    });
  } catch (error) {
    console.warn('Failed to find order for logging:', error)
    throw new Error('Database error: Could not find order')
  }

  if (!order) throw new Error("Order not found");

  // Determine inheritedKg (from previous stage log or targetKg if first stage)
  const inheritedKg = order.logs.length > 0 ? order.logs[0].kgOut : order.targetKg;

  return {
    ...order,
    inheritedKg,
  };
}

export async function updateOrderPriority(orderId: string, priority: string) {
  const user = await requireAuth();

  // Validate user permissions
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only admins and managers can update order priorities');
  }

  // Validate priority
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  if (!validPriorities.includes(priority)) {
    throw new Error('Invalid priority level');
  }

  await prisma.productionOrder.update({
    where: { id: orderId },
    data: { priority: priority as any }
  });

  revalidatePath('/admin/scheduling');
  revalidatePath('/production');

  return { success: true };
}
