"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, getUser } from "@/lib/auth";
import { productionOrderSchema, ProductionOrderInput } from "@/lib/validations";

export async function createProductionOrder(formData: FormData) {
  await requireRole("ADMIN");

  const designId = formData.get("designId") as string;
  const quantity = parseInt(formData.get("quantity") as string);
  const targetKg = parseFloat(formData.get("targetKg") as string);

  const input: ProductionOrderInput = {
    designId,
    quantity,
    targetKg,
  };

  productionOrderSchema.parse(input);

  const design = await prisma.design.findUnique({
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

  const order = await prisma.productionOrder.create({
    data: {
      designId: input.designId,
      quantity: input.quantity,
      targetKg: input.targetKg,
      status: "PENDING",
      currentStage: initialStage.sequence,
    },
  });

  redirect("/orders");
}

export async function approveProductionOrder(orderId: string) {
  await requireRole("ADMIN");

  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "PENDING") {
    throw new Error("Order is not pending approval");
  }

  await prisma.productionOrder.update({
    where: { id: orderId },
    data: {
      status: "APPROVED",
      approvedBy: user.email!,
      approvedAt: new Date(),
    },
  });

  redirect("/approvals");
}

export async function rejectProductionOrder(orderId: string) {
  await requireRole("ADMIN");

  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "PENDING") {
    throw new Error("Order is not pending approval");
  }

  await prisma.productionOrder.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });

  redirect("/approvals");
}