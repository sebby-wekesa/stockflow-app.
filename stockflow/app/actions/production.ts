"use server";

import { revalidatePath } from 'next/cache';
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { assertOperatorDepartment, getOperatorDepartments } from "@/lib/operator-access";

export type OperatorQueueItem = {
  id: string;
  orderNumber: string;
  designName: string;
  currentStage: number;
  totalStages: number;
  priority: string;
  targetKg: number;
  workDescription: string;
  inheritedKg: number;
};

export type OperatorHistoryItem = {
  id: string;
  orderNumber: string;
  designName: string;
  completedAt: Date;
  kgIn: number;
  kgOut: number;
  kgScrap: number;
  department: string;
  stageName: string;
};

export async function getOperatorQueue(role?: string, department?: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);
  void role;
  const effectiveRole = user.role;
  const operatorDepartments = getOperatorDepartments(user);
  const effectiveDept = department || operatorDepartments[0];
  if (user.role === 'OPERATOR' && effectiveDept) assertOperatorDepartment(user, effectiveDept);

  // If user is ADMIN or MANAGER, they see all queues.
  // If OPERATOR, they see their department's queue.
  let orders: any[] = []
  try {
    orders = await db.productionOrder.findMany({
      where: {
        status: "IN_PRODUCTION",
        ...(effectiveDept
          ? { currentDept: effectiveDept }
          : effectiveRole === "OPERATOR"
            ? { currentDept: { in: operatorDepartments } }
            : {}),
      },
      include: {
        design: {
          include: {
            stages: true,
          },
        },
        StageLog: {
          orderBy: { sequence: "desc" },
          take: 1,
          select: { kgOut: true },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  } catch (error) {
    console.warn('Failed to fetch operator queue:', error)
    orders = []
  }

  return orders.map((o): OperatorQueueItem => ({
    id: o.id,
    orderNumber: o.orderNumber,
    designName: o.design.name,
    currentStage: o.currentStage,
    totalStages: o.design.stages.length,
    priority: o.priority,
    targetKg: o.targetKg ? Number(o.targetKg) : 0,
    workDescription: o.design.stages.find((s: { sequence: number; name: string }) => s.sequence === o.currentStage)?.name || "Production",
    inheritedKg: o.StageLog[0]?.kgOut ? Number(o.StageLog[0].kgOut) : Number(o.targetKg ?? 0),
  }));
}

export async function getOperatorHistory() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  let logs: any[] = []
  try {
    logs = await db.stageLog.findMany({
      where: {
        operatorId: user.id,
      },
      include: {
        ProductionOrder: {
          include: {
            design: true,
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

  return logs.map((log): OperatorHistoryItem => ({
    id: log.id,
    orderNumber: log.ProductionOrder.orderNumber,
    designName: log.ProductionOrder.design.name,
    completedAt: log.completedAt,
    kgIn: Number(log.kgIn),
    kgOut: Number(log.kgOut),
    kgScrap: Number(log.kgScrap),
    department: log.department || "Unassigned",
    stageName: log.stageName,
  }));
}

export async function getOrderForLogging(id: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  let order
  try {
    order = await db.productionOrder.findUnique({
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
        StageLog: {
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
  assertOperatorDepartment(user, order.currentDept);

  // Determine inheritedKg (from previous stage log or targetKg if first stage)
  const inheritedKg = order.StageLog.length > 0 ? order.StageLog[0].kgOut : order.targetKg;

  return {
    ...order,
    inheritedKg,
  };
}

export async function updateOrderPriority(orderId: string, priority: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Validate user permissions
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only admins and managers can update order priorities');
  }

  // Validate priority
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  if (!validPriorities.includes(priority)) {
    throw new Error('Invalid priority level');
  }

  await db.productionOrder.update({
    where: { id: orderId },
    data: { priority: priority as any }
  });

  revalidatePath('/admin/scheduling');
  revalidatePath('/production');

  return { success: true };
}

export async function getActiveDepartments() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  try {
    const depts = await db.productionOrder.findMany({
      where: {
        status: { in: ["APPROVED", "IN_PRODUCTION"] },
      },
      select: { currentDept: true },
      distinct: ["currentDept"],
    });

    const active = depts
      .map(d => d.currentDept)
      .filter((d): d is string => !!d);

    if (user.role === 'OPERATOR') {
      return getOperatorDepartments(user).filter(department => active.includes(department));
    }
    return active;
  } catch (error) {
    console.warn("Failed to fetch active departments:", error);
    return [];
  }
}
