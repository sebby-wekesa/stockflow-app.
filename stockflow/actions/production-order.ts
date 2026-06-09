"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { productionOrderSchema, ProductionOrderInput } from "@/lib/validations";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { updateOrderStatus } from "@/app/actions/orders";
import { materializeOperationsForOrder } from "@/lib/operation-routing";

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

  const hasEyeRolling = design.stages.some(stage =>
    ['Eye Rolling', 'Scaffolding', 'Tapering'].some(keyword =>
      stage.name.toLowerCase().includes(keyword.toLowerCase())
    )
  );
  const resolvedRouteType = hasEyeRolling ? 'FML' : 'HML';

  await db.productionOrder.create({
    data: {
      orderNumber: input.orderNumber,
      designId: input.designId,
      quantity: input.quantity,
      targetKg: input.targetKg,
      status: "PENDING",
      currentStage: initialStage.sequence,
      organizationId: user.organizationId,
      routeType: resolvedRouteType,
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

// ─────────────────────────────────────────────────────────────────────────────
// DIRECT PRODUCTION ORDERS (no Design template required)
//
// The admin creates an order by stating: product name, the material(s) to use
// with cut length & pieces, and the expected finished-piece count. No design
// template needed. The production side later records actual weight out and
// actual pieces, and the system computes efficiency = actual / expected.
// ─────────────────────────────────────────────────────────────────────────────

type DirectMaterialLine = {
  rawMaterialId: string; // required — every material line links to a stocked raw material
  cutLength: number;
  pieces: number;
  totalLength?: number; // optional; defaults to cutLength * pieces
};

type DirectOrderInput = {
  productName: string;
  expectedPieces: number;
  quantity?: number;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  notes?: string | null;
  materials: DirectMaterialLine[];
  routeType?: "FML" | "HML" | null;        // leaf-spring route; null = not a routed product
  selectedOptionalNames?: string[];          // which optional eye-rolling steps this order uses
};

async function nextOrderNumber(db: ReturnType<typeof getTenantPrisma>): Promise<string> {
  const currentYear = new Date().getFullYear();
  const lastOrder = await db.productionOrder.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  });
  let nextNumber = 1;
  if (lastOrder?.orderNumber) {
    const match = lastOrder.orderNumber.match(/ORD-\d{4}-(\d{4})/);
    if (match) nextNumber = parseInt(match[1]) + 1;
  }
  return `ORD-${currentYear}-${nextNumber.toString().padStart(4, "0")}`;
}

export async function createDirectProductionOrder(input: DirectOrderInput) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  // ---- validation (server-side, never trust the client) ----
  const productName = (input.productName ?? "").trim();
  if (productName.length < 2) {
    return { success: false, error: "Product name is required" };
  }
  const expectedPieces = Number(input.expectedPieces);
  if (!Number.isFinite(expectedPieces) || expectedPieces <= 0) {
    return { success: false, error: "Expected finished pieces must be a positive number" };
  }
  if (!Array.isArray(input.materials) || input.materials.length === 0) {
    return { success: false, error: "Add at least one material line" };
  }

  const materialRows = [];
  for (const [i, m] of input.materials.entries()) {
    const rawMaterialId = (m.rawMaterialId ?? "").trim();
    const cut = Number(m.cutLength);
    const pieces = Number(m.pieces);
    if (!rawMaterialId) return { success: false, error: `Material line ${i + 1}: pick a material` };
    if (!Number.isFinite(cut) || cut <= 0)
      return { success: false, error: `Material line ${i + 1}: cut length must be positive` };
    if (!Number.isFinite(pieces) || pieces <= 0 || !Number.isInteger(pieces))
      return { success: false, error: `Material line ${i + 1}: pieces must be a whole number` };
    // total length defaults to cut x pieces but the admin can override it
    const total =
      m.totalLength != null && Number.isFinite(Number(m.totalLength)) && Number(m.totalLength) > 0
        ? Number(m.totalLength)
        : cut * pieces;
    // Use relation-connect syntax so the nested create satisfies the required
    // RawMaterial and Organization relations on ProductionOrderMaterial.
    materialRows.push({
      cutLength: cut,
      pieces,
      totalLength: total,
      RawMaterial: { connect: { id: rawMaterialId } },
      Organization: { connect: { id: user.organizationId } },
    });
  }

  const orderNumber = await nextOrderNumber(db);

  const routeType =
    input.routeType === "FML" || input.routeType === "HML" ? input.routeType : null;

  const order = await db.productionOrder.create({
    data: {
      orderNumber,
      designId: null, // direct order — no template
      productName,
      expectedPieces,
      quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
      priority: (input.priority as any) ?? "MEDIUM",
      targetKg: 0,
      status: "PENDING",
      currentStage: 1,
      routeType,
      organizationId: user.organizationId,
      materials: { create: materialRows },
    },
    include: { materials: true },
  });

  // If this is a routed leaf-spring order, auto-create its operation steps now,
  // so production just ticks them off (no separate "start routing" step). A
  // missing/unseeded route is not fatal — the order is still created; we surface
  // a warning so the admin can seed routes from the Operations page.
  let routingWarning: string | undefined;
  if (routeType) {
    const res = await materializeOperationsForOrder(
      db,
      user.organizationId,
      order.id,
      routeType,
      input.selectedOptionalNames
    );
    if (!res.ok) routingWarning = res.error;
  }

  return { success: true, orderId: order.id, orderNumber: order.orderNumber, routingWarning };
}

// Production-side: the production team weighs the material they put IN, and
// records the finished pieces (and optionally weight out) they got. THIS is the
// step that consumes raw material — not order approval. Approval only hands the
// order to the floor; the floor's recorded weight-in is what decrements stock.
export async function recordProductionOutput(
  orderId: string,
  input: {
    actualKgIn: number;          // weight of material actually fed in (consumes stock)
    actualPieces: number;        // finished pieces produced
    actualKgOut?: number | null; // optional finished weight out
    materialId?: string | null;  // which material line was consumed (if the order has several)
  }
) {
  const user = await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const db = getTenantPrisma(user.organizationId);

  const kgIn = Number(input.actualKgIn);
  const actual = Number(input.actualPieces);
  if (!Number.isFinite(kgIn) || kgIn <= 0) {
    return { success: false, error: "Enter the weight of material put in (kg)" };
  }
  if (!Number.isFinite(actual) || actual < 0) {
    return { success: false, error: "Actual pieces must be zero or more" };
  }

  // Run as a transaction so the stock decrement, consumption log, and order
  // update either all succeed or all roll back.
  const result = await db.$transaction(async (tx: any) => {
    const order = await tx.productionOrder.findUnique({
      where: { id: orderId },
      include: { materials: true },
    });
    if (!order) throw new Error("Order not found");

    // Decide which raw material to consume. If the production person named a
    // material line, use it; otherwise default to the order's single/first
    // material line that is linked to an actual RawMaterial record.
    type MatLine = { id: string; rawMaterialId: string | null };
    const linkedMaterials = order.materials.filter((m: MatLine) => m.rawMaterialId);
    let targetRawMaterialId: string | null = null;

    if (input.materialId) {
      const line = order.materials.find((m: MatLine) => m.id === input.materialId || m.rawMaterialId === input.materialId);
      targetRawMaterialId = line?.rawMaterialId ?? null;
    } else if (linkedMaterials.length === 1) {
      targetRawMaterialId = linkedMaterials[0].rawMaterialId;
    } else if (linkedMaterials.length > 1) {
      throw new Error("This order uses several materials — specify which one was consumed");
    }

    // Decrement raw material stock by the weight actually put in.
    if (targetRawMaterialId) {
      const rm = await tx.rawMaterial.findUnique({ where: { id: targetRawMaterialId } });
      if (!rm) throw new Error("Linked raw material not found");

      const available = Number(rm.availableKg);
      if (available < kgIn) {
        throw new Error(
          `Insufficient raw material: ${rm.materialName} has ${available}kg, but ${kgIn}kg was recorded as used`
        );
      }

      await tx.rawMaterial.update({
        where: { id: targetRawMaterialId },
        data: { availableKg: { decrement: kgIn } },
      });

      await tx.materialConsumptionLog.create({
        data: {
          quantityConsumed: kgIn,
          notes: `Consumed on production recording (${actual} pcs produced)`,
          ProductionOrder: { connect: { id: orderId } },
          RawMaterial: { connect: { id: targetRawMaterialId } },
          Organization: { connect: { id: user.organizationId } },
        },
      });
    }

    await tx.productionOrder.update({
      where: { id: orderId },
      data: {
        actualPieces: actual,
        outputRecordedAt: new Date(),
        outputRecordedBy: user.id,
        actualWeightOut:
          input.actualKgOut != null && Number.isFinite(Number(input.actualKgOut))
            ? Number(input.actualKgOut)
            : null,
      },
    });

    const expected = order.expectedPieces ?? 0;
    const efficiency = expected > 0 ? actual / expected : null;

    return {
      expectedPieces: expected,
      actualPieces: actual,
      kgConsumed: targetRawMaterialId ? kgIn : 0,
      rawMaterialAffected: Boolean(targetRawMaterialId),
      efficiency,
      efficiencyPct: efficiency != null ? Math.round(efficiency * 1000) / 10 : null,
    };
  });

  return { success: true, ...result };
}

// Optional: turn a one-off direct order into a reusable Design template so the
// admin doesn't have to retype it next time.
export async function saveOrderAsTemplate(orderId: string, templateName?: string) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const order = await db.productionOrder.findFirst({
    where: { id: orderId },
    include: { materials: true },
  });
  if (!order) return { success: false, error: "Order not found" };
  if (order.designId) return { success: false, error: "This order already uses a template" };

  const name = (templateName ?? order.productName ?? "Untitled product").trim();
  // Build a unique code from the name
  const baseCode = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 16) || "TMPL";
  let code = baseCode;
  for (let n = 2; n <= 50; n++) {
    const clash = await db.design.findFirst({ where: { code } });
    if (!clash) break;
    code = `${baseCode}-${n}`;
  }

  const design = await db.design.create({
    data: {
      name,
      code,
      description: `Saved from order ${order.orderNumber}`,
      expectedYield: order.expectedPieces ?? null,
      specifications: {
        expectedPieces: order.expectedPieces,
        materials: order.materials.map((m: {
          rawMaterialId: string
          cutLength: unknown
          pieces: number
          totalLength: unknown
        }) => ({
          rawMaterialId: m.rawMaterialId,
          cutLength: m.cutLength != null ? Number(m.cutLength) : null,
          pieces: m.pieces,
          totalLength: m.totalLength != null ? Number(m.totalLength) : null,
        })),
      },
      organizationId: user.organizationId,
    },
  });

  return { success: true, designId: design.id, code: design.code };
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
    // Direct order: update status to IN_PRODUCTION directly without design stages
    await db.productionOrder.update({
      where: { id: orderId },
      data: {
        status: "IN_PRODUCTION",
        currentStage: 1,
      },
    });
    redirect("/production");
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
