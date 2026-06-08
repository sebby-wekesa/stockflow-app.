"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";

const EYE_ROLLING_SECTION = "Eye Rolling Section";

const COMMON_TAIL = [
  { name: "Drilling", optional: false, section: null },
  { name: "Hardening", optional: false, section: null },
  { name: "Tempering", optional: false, section: null },
  { name: "Hardness Testing", optional: false, section: null },
  { name: "Cambering", optional: false, section: null },
  { name: "Assembly", optional: true, section: null },
  { name: "Painting", optional: false, section: null },
];

const ROUTE_DEFS = {
  FML: {
    name: "Leaf Spring - FML",
    operations: [
      { name: "Cutting", optional: false, section: null },
      { name: "Eye Rolling", optional: true, section: EYE_ROLLING_SECTION },
      { name: "Scaffolding", optional: true, section: EYE_ROLLING_SECTION },
      { name: "Tapering", optional: true, section: EYE_ROLLING_SECTION },
      ...COMMON_TAIL,
    ],
  },
  HML: {
    name: "Leaf Spring - HML",
    operations: [
      { name: "Cutting", optional: false, section: null },
      ...COMMON_TAIL,
    ],
  },
} as const;

const ALLOWED_ROLES = ["ADMIN", "MANAGER", "OPERATOR"] as const;

function revalidateOperations(orderId?: string) {
  revalidatePath("/operations");
  if (orderId) revalidatePath(`/operations/${orderId}`);
}

export async function seedLeafSpringRoutes() {
  const user = await requireRole("ADMIN", "MANAGER");

  await withTenantTransaction(user.organizationId, async (tx) => {
    for (const routeType of ["FML", "HML"] as const) {
      const definition = ROUTE_DEFS[routeType];
      const route = await tx.productionRoute.upsert({
        where: {
          organizationId_routeType: {
            organizationId: user.organizationId,
            routeType,
          },
        },
        update: { name: definition.name, isActive: true },
        create: {
          routeType,
          name: definition.name,
          isActive: true,
        },
      });

      await tx.routeOperation.deleteMany({ where: { routeId: route.id } });
      await tx.routeOperation.createMany({
        data: definition.operations.map((operation, index) => ({
          routeId: route.id,
          name: operation.name,
          sequence: index + 1,
          optional: operation.optional,
          section: operation.section,
        })),
      });
    }
  });

  revalidateOperations();
  return { success: true };
}

export async function startOrderRouting(orderId: string) {
  const user = await requireRole(...ALLOWED_ROLES);
  const db = getTenantPrisma(user.organizationId);
  const order = await db.productionOrder.findFirst({
    where: { id: orderId },
    select: { id: true, routeType: true },
  });

  if (!order) return { success: false, error: "Order not found" };
  if (!order.routeType) return { success: false, error: "This order has no FML/HML route" };

  const route = await db.productionRoute.findFirst({
    where: { routeType: order.routeType, isActive: true },
    include: { operations: { orderBy: { sequence: "asc" } } },
  });
  if (!route?.operations.length) {
    return { success: false, error: `No active ${order.routeType} route configured. Set up routes first.` };
  }

  try {
    await withTenantTransaction(user.organizationId, async (tx) => {
      const existing = await tx.operationLog.count({ where: { productionOrderId: orderId } });
      if (existing > 0) throw new Error("Routing already started for this order");

      await tx.operationLog.createMany({
        data: route.operations.map((operation: any) => ({
          productionOrderId: orderId,
          routeOperationId: operation.id,
          operationName: operation.name,
          sequence: operation.sequence,
          section: operation.section,
          optional: operation.optional,
          status: "PENDING",
        })),
      });
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not start routing" };
  }

  revalidateOperations(orderId);
  return { success: true };
}

export async function startOperation(operationLogId: string) {
  const user = await requireRole(...ALLOWED_ROLES);
  const db = getTenantPrisma(user.organizationId);
  const log = await db.operationLog.findFirst({ where: { id: operationLogId } });

  if (!log) return { success: false, error: "Operation not found" };
  if (log.status !== "PENDING") return { success: false, error: "Only pending operations can be started" };

  const [blocking, active] = await Promise.all([
    db.operationLog.findFirst({
      where: {
        productionOrderId: log.productionOrderId,
        sequence: { lt: log.sequence },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      orderBy: { sequence: "asc" },
    }),
    db.operationLog.findFirst({
      where: { productionOrderId: log.productionOrderId, status: "IN_PROGRESS" },
    }),
  ]);

  if (blocking) return { success: false, error: `Complete or skip ${blocking.operationName} first` };
  if (active) return { success: false, error: `${active.operationName} is already in progress` };

  const now = new Date();
  await withTenantTransaction(user.organizationId, async (tx) => {
    await tx.operationLog.update({
      where: { id: operationLogId },
      data: { status: "IN_PROGRESS", startedAt: now, operatorId: user.id },
    });
    await tx.productionOrder.updateMany({
      where: { id: log.productionOrderId, productionStartedAt: null },
      data: { productionStartedAt: now, status: "IN_PRODUCTION" },
    });
  });

  revalidateOperations(log.productionOrderId);
  return { success: true };
}

export async function finishOperation(operationLogId: string) {
  const user = await requireRole(...ALLOWED_ROLES);
  const db = getTenantPrisma(user.organizationId);
  const log = await db.operationLog.findFirst({ where: { id: operationLogId } });

  if (!log) return { success: false, error: "Operation not found" };
  if (log.status !== "IN_PROGRESS" || !log.startedAt) {
    return { success: false, error: "Start this operation before marking it done" };
  }

  const now = new Date();
  const durationSeconds = Math.max(0, Math.round((now.getTime() - log.startedAt.getTime()) / 1000));
  let orderFinished = false;

  await withTenantTransaction(user.organizationId, async (tx) => {
    await tx.operationLog.update({
      where: { id: operationLogId },
      data: { status: "DONE", completedAt: now, durationSeconds },
    });
    const remaining = await tx.operationLog.count({
      where: {
        productionOrderId: log.productionOrderId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });
    if (remaining === 0) {
      await tx.productionOrder.update({
        where: { id: log.productionOrderId },
        data: { productionFinishedAt: now, completedAt: now, status: "COMPLETED" },
      });
      orderFinished = true;
    }
  });

  revalidateOperations(log.productionOrderId);
  return { success: true, durationSeconds, orderFinished };
}

export async function setOperationSkipped(operationLogId: string, skipped: boolean) {
  const user = await requireRole(...ALLOWED_ROLES);
  const db = getTenantPrisma(user.organizationId);
  const log = await db.operationLog.findFirst({ where: { id: operationLogId } });

  if (!log) return { success: false, error: "Operation not found" };
  if (!log.optional) return { success: false, error: "Only optional operations can be skipped" };
  if (log.status === "DONE" || log.status === "IN_PROGRESS") {
    return { success: false, error: "An active or completed operation cannot be skipped" };
  }

  await db.operationLog.update({
    where: { id: operationLogId },
    data: { status: skipped ? "SKIPPED" : "PENDING" },
  });
  revalidateOperations(log.productionOrderId);
  return { success: true };
}

export async function getOrderOperations(orderId: string) {
  const user = await requireRole(...ALLOWED_ROLES);
  const db = getTenantPrisma(user.organizationId);
  const order = await db.productionOrder.findFirst({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      productName: true,
      routeType: true,
      status: true,
      productionStartedAt: true,
      productionFinishedAt: true,
      product: { select: { name: true } },
      design: { select: { name: true } },
    },
  });
  if (!order) return null;

  const operations = await db.operationLog.findMany({
    where: { productionOrderId: orderId },
    orderBy: { sequence: "asc" },
    include: { Operator: { select: { name: true } } },
  });
  const done = operations.filter((operation) => operation.status === "DONE");
  const elapsedSeconds = order.productionStartedAt
    ? Math.max(0, Math.round(((order.productionFinishedAt ?? new Date()).getTime() - order.productionStartedAt.getTime()) / 1000))
    : null;

  return {
    order: {
      ...order,
      productName: order.product?.name ?? order.design?.name ?? order.productName,
    },
    operations: operations.map((operation) => ({
      id: operation.id,
      name: operation.operationName,
      sequence: operation.sequence,
      section: operation.section,
      optional: operation.optional,
      status: operation.status,
      startedAt: operation.startedAt,
      completedAt: operation.completedAt,
      durationSeconds: operation.durationSeconds,
      operatorName: operation.Operator?.name ?? null,
    })),
    totals: {
      totalActiveSeconds: done.reduce((sum, operation) => sum + (operation.durationSeconds ?? 0), 0),
      elapsedSeconds,
      completedCount: done.length,
      totalCount: operations.filter((operation) => operation.status !== "SKIPPED").length,
    },
  };
}

export async function listRoutedOrders() {
  const user = await requireRole(...ALLOWED_ROLES);
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
      product: { select: { name: true } },
      design: { select: { name: true } },
      _count: { select: { operationLogs: true } },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    productName: order.product?.name ?? order.design?.name ?? order.productName,
    routeType: order.routeType,
    status: order.status,
    started: Boolean(order.productionStartedAt),
    finished: Boolean(order.productionFinishedAt),
    operationCount: order._count.operationLogs,
  }));
}
