"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";
import { materializeOperationsForOrder } from "@/lib/operation-routing";
import {
  buildProductionFlow,
  getProductionFlowStageDefinition,
  PRODUCTION_FLOW_STAGE_DEFINITIONS,
  resolveProductionFlowStageKey,
} from "@/lib/production-flow";

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE DEFINITIONS
//
// The standard leaf-spring routes. FML goes through the Eye Rolling section
// (whose three sub-steps are optional); HML skips that whole section. Assembly
// is optional and sits just before Painting.
// ─────────────────────────────────────────────────────────────────────────────

const EYE_ROLLING_SECTION = "Eye Rolling Section";

// Shared tail used by both routes (everything after the eye-rolling section).
const COMMON_TAIL = [
  { name: "Drilling", optional: false, section: null },
  { name: "Hardening", optional: false, section: null },
  { name: "Tempering", optional: false, section: null },
  { name: "Hardness Testing", optional: false, section: null },
  { name: "Cambering", optional: false, section: null },
  { name: "Assembly", optional: true, section: null }, // optional: only for full sets
  { name: "Painting", optional: false, section: null },
];

const FML_OPERATIONS = [
  { name: "Cutting", optional: false, section: null },
  // Eye Rolling section — all three are optional; an order uses any subset.
  { name: "Eye Rolling", optional: true, section: EYE_ROLLING_SECTION },
  { name: "Scaffolding", optional: true, section: EYE_ROLLING_SECTION },
  { name: "Tapering", optional: true, section: EYE_ROLLING_SECTION },
  ...COMMON_TAIL,
];

const HML_OPERATIONS = [
  { name: "Cutting", optional: false, section: null },
  // HML skips the entire Eye Rolling section.
  ...COMMON_TAIL,
];

const ROUTE_DEFS: Record<"FML" | "HML", { name: string; ops: typeof FML_OPERATIONS }> = {
  FML: { name: "Leaf Spring — FML", ops: FML_OPERATIONS },
  HML: { name: "Leaf Spring — HML", ops: HML_OPERATIONS },
};

// Create or refresh the two standard routes for the organization. Idempotent:
// running it again updates the operations to match the definitions above.
export async function seedLeafSpringRoutes() {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  for (const routeType of ["FML", "HML"] as const) {
    const def = ROUTE_DEFS[routeType];

    const route = await db.productionRoute.upsert({
      where: { organizationId_routeType: { organizationId: user.organizationId, routeType } },
      update: { name: def.name, isActive: true },
      create: {
        organizationId: user.organizationId,
        routeType,
        name: def.name,
        isActive: true,
      },
    });

    // Replace operations to match the canonical definition.
    await db.routeOperation.deleteMany({ where: { routeId: route.id } });
    await db.routeOperation.createMany({
      data: def.ops.map((op, i) => ({
        organizationId: user.organizationId,
        routeId: route.id,
        name: op.name,
        sequence: i + 1,
        optional: op.optional,
        section: op.section,
      })),
    });
  }

  revalidatePath("/operations");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// START THE ROUTED FLOW FOR AN ORDER
//
// When a production order is ready to begin its operation flow, this materialises
// one OperationLog per applicable RouteOperation. Optional eye-rolling sub-steps
// the operator did NOT select are recorded as SKIPPED so the trail is complete.
// ─────────────────────────────────────────────────────────────────────────────

export async function startOrderRouting(
  orderId: string,
  opts?: { selectedOptionalNames?: string[] } // names of optional ops this order WILL go through
) {
  const user = await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const db = getTenantPrisma(user.organizationId);

  const order = await db.productionOrder.findFirst({
    where: { id: orderId },
    select: { id: true, routeType: true },
  });
  if (!order) return { success: false, error: "Order not found" };
  if (!order.routeType) {
    return { success: false, error: "This order has no route (FML/HML) set" };
  }

  const res = await materializeOperationsForOrder(
    db,
    user.organizationId,
    orderId,
    order.routeType as "FML" | "HML",
    opts?.selectedOptionalNames
  );
  if (!res.ok) return { success: false, error: res.error };

  revalidatePath(`/operations/${orderId}`);
  revalidatePath("/operations");
  return { success: true, operationCount: res.count };
}

// ─────────────────────────────────────────────────────────────────────────────
// START / FINISH A SINGLE OPERATION (the two-tap timing)
// ─────────────────────────────────────────────────────────────────────────────

export async function startOperation(operationLogId: string) {
  const user = await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const db = getTenantPrisma(user.organizationId);

  const log = await db.operationLog.findFirst({ where: { id: operationLogId } });
  if (!log) return { success: false, error: "Operation not found" };
  if (log.status === "DONE") return { success: false, error: "Operation already completed" };
  if (log.status === "SKIPPED") return { success: false, error: "Operation was skipped" };

  const now = new Date();

  await db.$transaction(async (tx: any) => {
    await tx.operationLog.update({
      where: { id: operationLogId },
      data: { status: "IN_PROGRESS", startedAt: now, operatorId: user.id },
    });
    // Stamp the order's production start on the first operation that begins.
    await tx.productionOrder.updateMany({
      where: { id: log.productionOrderId, productionStartedAt: null },
      data: { productionStartedAt: now },
    });
  });

  revalidatePath(`/operations/${log.productionOrderId}`);
  return { success: true, startedAt: now };
}

export async function finishOperation(operationLogId: string, notes?: string) {
  const user = await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const db = getTenantPrisma(user.organizationId);

  const log = await db.operationLog.findFirst({ where: { id: operationLogId } });
  if (!log) return { success: false, error: "Operation not found" };
  if (log.status === "DONE") return { success: false, error: "Operation already completed" };
  if (log.status === "SKIPPED") return { success: false, error: "Operation was skipped" };

  const now = new Date();
  const startedAt = log.startedAt ?? now; // if they finish without starting, duration = 0
  const durationSeconds = Math.max(0, Math.round((now.getTime() - new Date(startedAt).getTime()) / 1000));

  const result = await db.$transaction(async (tx: any) => {
    await tx.operationLog.update({
      where: { id: operationLogId },
      data: {
        status: "DONE",
        startedAt,
        completedAt: now,
        durationSeconds,
        operatorId: log.operatorId ?? user.id,
        notes: notes ?? log.notes ?? null,
      },
    });

    // If every non-skipped operation is now done, finish the order.
    const remaining = await tx.operationLog.count({
      where: {
        productionOrderId: log.productionOrderId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });

    let orderFinished = false;
    if (remaining === 0) {
      await tx.productionOrder.update({
        where: { id: log.productionOrderId },
        data: { productionFinishedAt: now, status: "COMPLETED", completedAt: now },
      });
      orderFinished = true;
    }
    return { orderFinished };
  });

  revalidatePath(`/operations/${log.productionOrderId}`);
  revalidatePath("/operations");
  return { success: true, durationSeconds, orderFinished: result.orderFinished };
}

// Skip / un-skip an optional operation mid-flow.
export async function setOperationSkipped(operationLogId: string, skipped: boolean) {
  const user = await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const db = getTenantPrisma(user.organizationId);

  const log = await db.operationLog.findFirst({ where: { id: operationLogId } });
  if (!log) return { success: false, error: "Operation not found" };
  if (!log.optional) return { success: false, error: "Only optional operations can be skipped" };
  if (log.status === "DONE") return { success: false, error: "Operation already completed" };

  await db.operationLog.update({
    where: { id: operationLogId },
    data: { status: skipped ? "SKIPPED" : "PENDING" },
  });
  revalidatePath(`/operations/${log.productionOrderId}`);
  return { success: true };
}

export async function completeProductionFlowStage(input: {
  orderId: string;
  stageKey: string;
  kgIn: number;
  kgOut: number;
  kgScrap: number;
  scrapReason?: string;
  notes?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const definition = getProductionFlowStageDefinition(input.stageKey);
  const validScrapReasons = new Set([
    "MACHINE_FAULT",
    "MATERIAL_DEFECT",
    "HUMAN_ERROR",
    "PROCESS_LOSS",
  ]);

  if (!definition) return { success: false, error: "Unknown production stage" };

  const kgIn = Number(input.kgIn);
  const kgOut = Number(input.kgOut);
  const kgScrap = Number(input.kgScrap);
  if (![kgIn, kgOut, kgScrap].every(Number.isFinite)) {
    return { success: false, error: "Enter valid kg values" };
  }
  if (kgIn < 0 || kgOut < 0 || kgScrap < 0) {
    return { success: false, error: "Kg values cannot be negative" };
  }
  if (
    definition.key !== "electroplating" &&
    Math.abs(kgIn - (kgOut + kgScrap)) > 0.01
  ) {
    return { success: false, error: "Kg In must equal Kg Out plus Kg Scrap" };
  }
  if (kgScrap > 0 && !input.scrapReason?.trim()) {
    return { success: false, error: "Select a scrap reason when scrap is recorded" };
  }
  if (input.scrapReason?.trim() && !validScrapReasons.has(input.scrapReason.trim())) {
    return { success: false, error: "Select a valid scrap reason" };
  }

  try {
    const result = await withTenantTransaction(user.organizationId, async (tx: any) => {
      const order = await tx.productionOrder.findFirst({
        where: { id: input.orderId },
        include: {
          StageLog: { orderBy: { completedAt: "asc" } },
          operationLogs: { orderBy: { sequence: "asc" } },
        },
      });
      if (!order) throw new Error("Production order not found");
      if (["PENDING", "REJECTED", "CANCELLED"].includes(order.status)) {
        throw new Error("Production order has not been released");
      }

      const completedKeys = new Set<string>();
      for (const log of order.StageLog) {
        const key = resolveProductionFlowStageKey(log.stageName) ??
          resolveProductionFlowStageKey(log.department);
        if (key) completedKeys.add(key);
      }
      for (const operation of order.operationLogs) {
        if (operation.status !== "DONE") continue;
        const key = resolveProductionFlowStageKey(operation.operationName);
        if (key) completedKeys.add(key);
      }
      const activeOperation = order.operationLogs.find(
        (operation: any) => operation.status === "IN_PROGRESS",
      );
      const activeStageKey = resolveProductionFlowStageKey(order.currentDept) ??
        resolveProductionFlowStageKey(activeOperation?.operationName ?? null);
      const activeDefinition = activeStageKey
        ? getProductionFlowStageDefinition(activeStageKey)
        : null;
      if (activeDefinition) {
        for (const stage of PRODUCTION_FLOW_STAGE_DEFINITIONS) {
          if (stage.sequence < activeDefinition.sequence) completedKeys.add(stage.key);
        }
      }
      if (order.status === "COMPLETED") {
        for (const stage of PRODUCTION_FLOW_STAGE_DEFINITIONS.slice(0, 6)) {
          completedKeys.add(stage.key);
        }
      }

      const expectedStage = PRODUCTION_FLOW_STAGE_DEFINITIONS.find(
        (stage) => !completedKeys.has(stage.key),
      );
      if (!expectedStage) throw new Error("All production workflow stages are complete");
      if (expectedStage.key !== definition.key) {
        throw new Error(`Complete ${expectedStage.name} before ${definition.name}`);
      }
      if (definition.key === "packaging" && order.status !== "COMPLETED") {
        throw new Error("Finished Goods must be completed before Packaging");
      }
      if (definition.key !== "packaging" && order.status !== "IN_PRODUCTION") {
        throw new Error("Order is not in production");
      }

      const priorKeys = new Set(
        PRODUCTION_FLOW_STAGE_DEFINITIONS
          .filter((stage) => stage.sequence < definition.sequence)
          .map((stage) => stage.key),
      );
      const priorLog = [...order.StageLog].reverse().find((log: any) => {
        const key = resolveProductionFlowStageKey(log.stageName) ??
          resolveProductionFlowStageKey(log.department);
        return key ? priorKeys.has(key) : false;
      });
      const expectedKgIn = priorLog?.kgOut != null
        ? Number(priorLog.kgOut)
        : definition.key === "packaging" && order.actualWeightOut != null
          ? Number(order.actualWeightOut)
          : Number(order.targetKg);
      if (expectedKgIn > 0 && Math.abs(expectedKgIn - kgIn) > 0.01) {
        throw new Error(`Kg In must match the previous output of ${expectedKgIn.toFixed(2)} kg`);
      }

      const now = new Date();
      const matchingOperations = order.operationLogs.filter((operation: any) =>
        operation.status !== "DONE" &&
        operation.status !== "SKIPPED" &&
        resolveProductionFlowStageKey(operation.operationName) === definition.key
      );
      for (const operation of matchingOperations) {
        const startedAt = operation.startedAt ?? now;
        const durationSeconds = Math.max(
          0,
          Math.round((now.getTime() - new Date(startedAt).getTime()) / 1000),
        );
        await tx.operationLog.update({
          where: { id: operation.id },
          data: {
            status: "DONE",
            startedAt,
            completedAt: now,
            durationSeconds,
            operatorId: operation.operatorId ?? user.id,
          },
        });
      }

      const stageLog = await tx.stageLog.create({
        data: {
          organizationId: user.organizationId,
          orderId: order.id,
          stageName: definition.name,
          sequence: definition.sequence,
          kgIn,
          kgOut,
          kgScrap,
          scrapReason: input.scrapReason?.trim() || null,
          department: definition.department,
          operatorId: user.id,
          notes: input.notes?.trim() || null,
          completedAt: now,
        },
      });

      const nextStage = PRODUCTION_FLOW_STAGE_DEFINITIONS.find(
        (stage) => stage.sequence === definition.sequence + 1,
      );
      if (definition.key === "finished-goods") {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
            productionFinishedAt: now,
            actualWeightOut: kgOut,
            outputRecordedAt: now,
            outputRecordedBy: user.id,
            currentStage: definition.sequence + 1,
            currentDept: nextStage?.department ?? "Packaging",
          },
        });
      } else if (definition.key === "packaging") {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: {
            currentStage: definition.sequence + 1,
            currentDept: "Ready for dispatch",
          },
        });
      } else {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: {
            productionStartedAt: order.productionStartedAt ?? now,
            currentStage: nextStage?.sequence ?? definition.sequence + 1,
            currentDept: nextStage?.department ?? null,
          },
        });
      }

      return { stageLog, nextStage };
    });

    revalidatePath("/operations");
    revalidatePath(`/operations/${input.orderId}`);
    revalidatePath("/jobs");
    revalidatePath("/dashboard");
    revalidatePath("/packaging");
    return {
      success: true,
      completedStage: definition.name,
      nextStage: result.nextStage?.name ?? null,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete stage",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ: the full operation trail for an order (with durations + totals)
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrderOperations(orderId: string) {
  const user = await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const db = getTenantPrisma(user.organizationId);

  const order = await db.productionOrder.findFirst({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      productName: true,
      routeType: true,
      status: true,
      expectedPieces: true,
      actualPieces: true,
      productionStartedAt: true,
      productionFinishedAt: true,
    },
  });
  if (!order) return null;

  const ops = await db.operationLog.findMany({
    where: { productionOrderId: orderId },
    orderBy: { sequence: "asc" },
    include: { Operator: { select: { name: true } } },
  });

  const doneOps = ops.filter((o: any) => o.status === "DONE");
  const totalActiveSeconds = doneOps.reduce((s: number, o: any) => s + (o.durationSeconds ?? 0), 0);

  // Wall-clock total (start of first op to finish of last) if available.
  let elapsedSeconds: number | null = null;
  if (order.productionStartedAt) {
    const end = order.productionFinishedAt ?? new Date();
    elapsedSeconds = Math.max(
      0,
      Math.round((new Date(end).getTime() - new Date(order.productionStartedAt).getTime()) / 1000)
    );
  }

  return {
    order,
    operations: ops.map((o: any) => ({
      id: o.id,
      name: o.operationName,
      sequence: o.sequence,
      section: o.section,
      optional: o.optional,
      status: o.status,
      startedAt: o.startedAt,
      completedAt: o.completedAt,
      durationSeconds: o.durationSeconds,
      operatorName: o.Operator?.name ?? null,
      notes: o.notes,
    })),
    totals: {
      totalActiveSeconds, // sum of per-operation durations (hands-on time)
      elapsedSeconds,     // wall-clock from first start to last finish
      completedCount: doneOps.length,
      totalCount: ops.filter((o: any) => o.status !== "SKIPPED").length,
    },
  };
}

// List orders that have a route, for the operations dashboard.
export async function listRoutedOrders() {
  const user = await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const db = getTenantPrisma(user.organizationId);

  const orders = await db.productionOrder.findMany({
    where: { routeType: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      productName: true,
      routeType: true,
      status: true,
      productionStartedAt: true,
      productionFinishedAt: true,
      _count: { select: { operationLogs: true } },
    },
  });

  return orders.map((o: any) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    productName: o.productName,
    routeType: o.routeType,
    status: o.status,
    started: Boolean(o.productionStartedAt),
    finished: Boolean(o.productionFinishedAt),
    operationCount: o._count.operationLogs,
  }));
}

// Project every production order onto the fixed end-to-end workflow used by
// the operations dashboard. Evidence comes from the order lifecycle, stage
// logs, routed operation logs, and linked sales/packaging state.
export async function listProductionOrderFlows() {
  const user = await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const db = getTenantPrisma(user.organizationId);

  const orders = await db.productionOrder.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      productName: true,
      routeType: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      approvedBy: true,
      approvedAt: true,
      completedAt: true,
      productionStartedAt: true,
      productionFinishedAt: true,
      outputRecordedAt: true,
      outputRecordedBy: true,
      assignedTo: true,
      currentDept: true,
      targetKg: true,
      actualWeightOut: true,
      design: {
        select: {
          name: true,
          billOfMaterials: { select: { id: true } },
        },
      },
      materials: { select: { id: true } },
      saleOrder: {
        select: {
          status: true,
          createdAt: true,
          updatedAt: true,
          createdByUser: { select: { name: true, email: true } },
        },
      },
      StageLog: {
        orderBy: { sequence: "asc" },
        select: {
          stageName: true,
          department: true,
          kgIn: true,
          kgOut: true,
          kgScrap: true,
          completedAt: true,
          User: { select: { name: true, email: true } },
        },
      },
      operationLogs: {
        orderBy: { sequence: "asc" },
        select: {
          operationName: true,
          status: true,
          startedAt: true,
          completedAt: true,
          Operator: { select: { name: true, email: true } },
        },
      },
      _count: { select: { operationLogs: true } },
    },
  });

  const userIds = Array.from(new Set(
    orders.flatMap((order: any) =>
      [order.approvedBy, order.assignedTo, order.outputRecordedBy].filter(Boolean),
    ),
  ));
  const namedUsers = userIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userNames = new Map(
    namedUsers.map((namedUser) => [
      namedUser.id,
      namedUser.name ?? namedUser.email,
    ]),
  );

  return orders.map((order: any) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    productName: order.design?.name ?? order.productName ?? "Direct order",
    routeType: order.routeType,
    status: order.status,
    operationCount: order._count.operationLogs,
    stages: buildProductionFlow({
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      approvedAt: order.approvedAt,
      completedAt: order.completedAt,
      productionStartedAt: order.productionStartedAt,
      productionFinishedAt: order.productionFinishedAt,
      outputRecordedAt: order.outputRecordedAt,
      currentDept: order.currentDept,
      targetKg: Number(order.targetKg),
      actualWeightOut:
        order.actualWeightOut == null ? null : Number(order.actualWeightOut),
      materialCount:
        order.materials.length + (order.design?.billOfMaterials.length ?? 0),
      reviewerName: order.approvedBy
        ? userNames.get(order.approvedBy) ?? null
        : null,
      assignedOperatorName: order.assignedTo
        ? userNames.get(order.assignedTo) ?? null
        : null,
      outputRecorderName: order.outputRecordedBy
        ? userNames.get(order.outputRecordedBy) ?? null
        : null,
      saleOrder: order.saleOrder
        ? {
            status: order.saleOrder.status,
            createdAt: order.saleOrder.createdAt,
            updatedAt: order.saleOrder.updatedAt,
            operatorName:
              order.saleOrder.createdByUser?.name ??
              order.saleOrder.createdByUser?.email ??
              null,
          }
        : null,
      stageLogs: order.StageLog.map((log: any) => ({
        stageName: log.stageName,
        department: log.department,
        kgIn: Number(log.kgIn),
        kgOut: Number(log.kgOut),
        kgScrap: Number(log.kgScrap),
        operatorName: log.User?.name ?? log.User?.email ?? null,
        completedAt: log.completedAt,
      })),
      operationLogs: order.operationLogs.map((operation: any) => ({
        name: operation.operationName,
        status: operation.status,
        operatorName:
          operation.Operator?.name ?? operation.Operator?.email ?? null,
        startedAt: operation.startedAt,
        completedAt: operation.completedAt,
      })),
    }),
  }));
}
