"use server";

import { revalidatePath } from 'next/cache';
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { assertOperatorDepartment, getOperatorDepartments } from "@/lib/operator-access";

export type OperatorQueueItem = {
  id: string;
  orderNumber: string;
  designName: string;
  isDirectOrder: boolean;
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

export type ProductionOutputResult = {
  success: true;
  efficiency: number;
  actualPieces: number;
  expectedPieces: number;
  materialConsumedKg: number;
  materialConsumedPieces: number;
};

export async function recordProductionOutput(data: {
  orderId: string;
  materialLineId?: string;
  weightIn: number;
  actualPieces: number;
  actualWeightOut?: number | null;
  notes?: string;
}): Promise<ProductionOutputResult> {
  const user = await requireActiveAuth();
  if (!["OPERATOR", "ADMIN", "MANAGER"].includes(user.role)) {
    throw new Error("Only production staff can record output");
  }

  const weightIn = Number(data.weightIn);
  const actualPieces = Number(data.actualPieces);
  const actualWeightOut = data.actualWeightOut == null || data.actualWeightOut === 0
    ? null
    : Number(data.actualWeightOut);

  if (!data.orderId) throw new Error("Order is required");
  if (!Number.isFinite(weightIn) || weightIn <= 0) {
    throw new Error("Weight in must be a positive number");
  }
  if (!Number.isInteger(actualPieces) || actualPieces <= 0) {
    throw new Error("Actual finished pieces must be a positive whole number");
  }
  if (actualWeightOut != null && (!Number.isFinite(actualWeightOut) || actualWeightOut < 0)) {
    throw new Error("Weight out cannot be negative");
  }

  return withTenantTransaction(user.organizationId, async (tx) => {
    const order = await tx.productionOrder.findUnique({
      where: { id: data.orderId },
      include: {
        materials: {
          include: { RawMaterial: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) throw new Error("Production order not found");
    if (order.designId) throw new Error("Use stage logging for saved-template orders");
    if (order.status !== "IN_PRODUCTION") throw new Error("Order is not in production");
    if (order.outputRecordedAt) throw new Error("Production output has already been recorded");
    if (!order.expectedPieces || order.expectedPieces <= 0) {
      throw new Error("Direct order is missing expected finished pieces");
    }
    assertOperatorDepartment(user, order.currentDept);

    if (order.materials.length === 0) {
      throw new Error("Direct order has no material lines");
    }

    const selectedLine = data.materialLineId
      ? order.materials.find((line: any) => line.id === data.materialLineId)
      : order.materials.length === 1
        ? order.materials[0]
        : null;

    if (!selectedLine) {
      throw new Error("Choose which material was consumed");
    }

    const availableKg = Number(selectedLine.RawMaterial.availableKg);
    const piecesUsed = Number(selectedLine.pieces);
    if (availableKg < weightIn) {
      throw new Error(
        `Insufficient stock for ${selectedLine.RawMaterial.materialName}. Available: ${availableKg.toFixed(2)}kg, requested: ${weightIn.toFixed(2)}kg`
      );
    }
    if (selectedLine.RawMaterial.availablePieces < piecesUsed) {
      throw new Error(
        `Insufficient pieces for ${selectedLine.RawMaterial.materialName}. Available: ${selectedLine.RawMaterial.availablePieces}, requested: ${piecesUsed}`
      );
    }

    await tx.rawMaterial.update({
      where: { id: selectedLine.rawMaterialId },
      data: {
        availableKg: { decrement: weightIn },
        availablePieces: { decrement: piecesUsed },
      },
    });

    await tx.materialConsumptionLog.create({
      data: {
        productionOrderId: order.id,
        rawMaterialId: selectedLine.rawMaterialId,
        quantityConsumed: weightIn,
        notes: data.notes?.trim() || `Consumed ${weightIn}kg and ${piecesUsed} pieces/sets when direct order output was recorded`,
      },
    });

    await tx.productionOrder.update({
      where: { id: order.id },
      data: {
        actualPieces,
        actualWeightOut,
        outputRecordedAt: new Date(),
        outputRecordedBy: user.id,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    const efficiency = (actualPieces / order.expectedPieces) * 100;
    revalidatePath("/dashboard");
    revalidatePath("/jobs");
    revalidatePath("/operator_log");
    revalidatePath("/operator_queue");
    revalidatePath("/stock");

    return {
      success: true,
      efficiency: Math.round(efficiency * 10) / 10,
      actualPieces,
      expectedPieces: order.expectedPieces,
      materialConsumedKg: weightIn,
      materialConsumedPieces: piecesUsed,
    };
  });
}

export async function getOperatorQueue(role?: string, department?: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);
  void role;
  const effectiveDept = department?.trim() || undefined;

  // Operators can work on any production job. Department is only a UI filter.
  let orders: any[] = []
  try {
    orders = await db.productionOrder.findMany({
      where: {
        status: "IN_PRODUCTION",
        ...(effectiveDept ? { currentDept: effectiveDept } : {}),
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
    designName: o.design?.name ?? o.productName ?? "Direct order",
    isDirectOrder: !o.designId,
    currentStage: o.currentStage,
    totalStages: o.design?.stages.length ?? 1,
    priority: o.priority,
    targetKg: o.targetKg ? Number(o.targetKg) : 0,
    workDescription: o.design?.stages.find((s: { sequence: number; name: string }) => s.sequence === o.currentStage)?.name || "Record production output",
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
    designName: log.ProductionOrder.design?.name ?? log.ProductionOrder.productName ?? "Direct order",
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
        materials: {
          include: {
            RawMaterial: true,
          },
          orderBy: {
            createdAt: "asc",
          },
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

    return active;
  } catch (error) {
    console.warn("Failed to fetch active departments:", error);
    return [];
  }
}
