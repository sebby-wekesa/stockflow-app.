"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { productionOrderSchema, ProductionOrderInput } from "@/lib/validations";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { updateOrderStatus } from "@/app/actions/orders";

export async function createProductionOrder(formData: FormData) {
  const user = await requireRole("ADMIN");
  const db = getTenantPrisma(user.organizationId);

  const designId = formData.get("designId") as string;
  const quantity = parseInt(formData.get("quantity") as string);
  const targetKg = parseFloat(formData.get("targetKg") as string);

  // Generate order number (ORD-YYYY-NNNN)
  const currentYear = new Date().getFullYear();
  const lastOrder = await db.productionOrder.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });

  let nextNumber = 1;
  if (lastOrder?.orderNumber) {
    const match = lastOrder.orderNumber.match(/ORD-\d{4}-(\d{4})/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  const orderNumber = `ORD-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;

  const input: ProductionOrderInput = {
    designId,
    quantity,
    targetKg,
    orderNumber,
  };

  productionOrderSchema.parse(input);

  const design = await db.design.findUnique({
    where: { id: designId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });

  if (!design) {
    throw new Error("Design not found");
  }

  if (design.stages.length === 0) {
    throw new Error("Design must have at least one stage");
  }
  const initialStage = design.stages[0];

  await db.productionOrder.create({
    data: {
      orderNumber: input.orderNumber,
      designId: input.designId,
      quantity: input.quantity,
      targetKg: input.targetKg,
      status: "PENDING",
      currentStage: initialStage.sequence,
      organizationId: user.organizationId,
    },
  });

  redirect("/orders");
}

export async function approveProductionOrder(orderId: string) {
  await requireRole("ADMIN", "MANAGER");
  const result = await updateOrderStatus(orderId, "APPROVED");
  if (!result.success) throw new Error(result.error);

  redirect("/approvals");
}

export async function releaseProductionOrder(orderId: string) {
  const user = await requireRole("ADMIN");
  const db = getTenantPrisma(user.organizationId);

  const order = await db.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      design: {
        include: {
          stages: {
            orderBy: { sequence: "asc" }
          }
        }
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "APPROVED") {
    throw new Error("Order must be approved before release to production");
  }

  if (!order.design) {
    throw new Error("Direct orders are released during approval");
  }

  if (order.design.stages.length === 0) {
    throw new Error("Design must have at least one production stage");
  }

  const firstStage = order.design.stages[0];

  // Update order to IN_PRODUCTION status and set initial stage
  await db.productionOrder.update({
    where: { id: orderId },
    data: {
      status: "IN_PRODUCTION",
      currentStage: firstStage.sequence,
      currentDept: firstStage.department
    },
  });

  redirect("/production");
}

export async function rejectProductionOrder(orderId: string) {
  const user = await requireRole("ADMIN");
  const db = getTenantPrisma(user.organizationId);

  const order = await db.productionOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "PENDING") {
    throw new Error("Order is not pending approval");
  }

  await db.productionOrder.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });

  redirect("/approvals");
}
