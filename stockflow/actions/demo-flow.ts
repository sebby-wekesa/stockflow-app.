"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";
import { consumeSaleOrderReservation, reserveSaleOrder } from "@/lib/order-lifecycle";
import {
  buildProductionFlow,
  getProductionFlowStageDefinition,
  PRODUCTION_FLOW_STAGE_DEFINITIONS,
  resolveProductionFlowStageKey,
  type ProductionFlowStage,
} from "@/lib/production-flow";
import { PACKAGING_DISPATCHED_DEPT } from "@/lib/packaging-workflow";

type TransactionClient = any;

export type DemoPhaseStatus = "DONE" | "ACTIVE" | "WAITING";

export type DemoFlowPhase = {
  key: string;
  label: string;
  detail: string;
  status: DemoPhaseStatus;
};

export type DemoFlowSnapshot = {
  exists: boolean;
  isComplete: boolean;
  saleOrderId: string | null;
  productionOrderId: string | null;
  productionOrderNumber: string | null;
  customerName: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  saleStatus: string | null;
  productionStatus: string | null;
  currentHandoff: string;
  nextActionLabel: string;
  nextActionDetail: string;
  completedStages: number;
  totalStages: number;
  targetKg: number;
  finishedKg: number | null;
  phases: DemoFlowPhase[];
  stages: ProductionFlowStage[];
};

const DEMO_QUANTITY = 24;
const DEMO_UNIT_PRICE = 1450;
const DEMO_TARGET_KG = 60;
const DEMO_PRODUCT_NAME = "M16 U-bolt demo batch";
const DEMO_CUSTOMER_NAME = "Demo Transport Ltd";

const PROCESS_STAGE_KEYS = [
  "cutting",
  "forging-chamfering",
  "threading-locking",
  "electroplating",
  "drilling-grinding",
  "finished-goods",
];

const STAGE_SCRIPT: Record<string, { scrapKg: number; notes: string }> = {
  cutting: { scrapKg: 1.2, notes: "Demo cut lengths checked against the sales request." },
  "forging-chamfering": { scrapKg: 1, notes: "Demo heat bend and chamfer pass completed." },
  "threading-locking": { scrapKg: 0.8, notes: "Demo threads and lock-nuts checked." },
  electroplating: { scrapKg: 0, notes: "Demo plating batch released with no process loss." },
  "drilling-grinding": { scrapKg: 0.6, notes: "Demo drilling, deburr, and grinding completed." },
  "finished-goods": { scrapKg: 0, notes: "Demo finished goods recorded for sales fulfillment." },
};

function demoKeys(organizationId: string) {
  const suffix = organizationId.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase() || "ORG";

  return {
    designCode: `DEMO-U-BOLT-${suffix}`,
    rawMaterialSku: `DEMO-RM-ROUND-BAR-${suffix}`,
    customerCode: `DEMO-CUSTOMER-${suffix}`,
    finishedGoodsSku: `DEMO-FG-U-BOLT-${suffix}`,
    saleOrderId: `DEMO-SO-${suffix}`,
    productionOrderNumber: `DEMO-PO-${suffix}`,
  };
}

function revalidateDemoPaths() {
  revalidatePath("/demo-flow");
  revalidatePath("/operations");
  revalidatePath("/packaging");
  revalidatePath("/pack_done");
  revalidatePath("/sales");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

async function ensureDemoFoundation(tx: TransactionClient, organizationId: string) {
  const keys = demoKeys(organizationId);

  let rawMaterial = await tx.rawMaterial.findFirst({
    where: { sku: keys.rawMaterialSku },
  });

  if (rawMaterial) {
    rawMaterial = await tx.rawMaterial.update({
      where: { id: rawMaterial.id },
      data: {
        materialName: "Demo 16mm round bar",
        diameter: "16mm",
        category: "Round Bars",
        length: "6000mm",
        width: "16mm",
        height: "16mm",
        availableKg: 800,
        reservedKg: 0,
        availablePieces: 320,
        costPerKg: 180,
      },
    });
  } else {
    rawMaterial = await tx.rawMaterial.create({
      data: {
        sku: keys.rawMaterialSku,
        materialName: "Demo 16mm round bar",
        diameter: "16mm",
        category: "Round Bars",
        length: "6000mm",
        width: "16mm",
        height: "16mm",
        availableKg: 800,
        reservedKg: 0,
        availablePieces: 320,
        costPerKg: 180,
      },
    });
  }

  let design = await tx.design.findFirst({
    where: { code: keys.designCode },
  });

  if (design) {
    design = await tx.design.update({
      where: { id: design.id },
      data: {
        name: DEMO_PRODUCT_NAME,
        description: "Guided sales-to-fulfillment demo product.",
        category: "U-bolts",
        targetWeight: DEMO_TARGET_KG / DEMO_QUANTITY,
        expectedYield: DEMO_QUANTITY,
      },
    });
  } else {
    design = await tx.design.create({
      data: {
        name: DEMO_PRODUCT_NAME,
        code: keys.designCode,
        description: "Guided sales-to-fulfillment demo product.",
        category: "U-bolts",
        targetWeight: DEMO_TARGET_KG / DEMO_QUANTITY,
        expectedYield: DEMO_QUANTITY,
      },
    });
  }

  const stageDefinitions = PRODUCTION_FLOW_STAGE_DEFINITIONS
    .filter((stage) => PROCESS_STAGE_KEYS.includes(stage.key) && stage.key !== "finished-goods");

  for (const stage of stageDefinitions) {
    const existingStage = await tx.stage.findFirst({
      where: { designId: design.id, sequence: stage.sequence },
    });

    if (existingStage) {
      await tx.stage.update({
        where: { id: existingStage.id },
        data: {
          name: stage.name,
          department: stage.department,
        },
      });
    } else {
      await tx.stage.create({
        data: {
          designId: design.id,
          name: stage.name,
          department: stage.department,
          sequence: stage.sequence,
        },
      });
    }
  }

  const bom = await tx.billOfMaterials.findFirst({
    where: { designId: design.id, rawMaterialId: rawMaterial.id },
  });

  if (bom) {
    await tx.billOfMaterials.update({
      where: { id: bom.id },
      data: {
        quantity: DEMO_TARGET_KG / DEMO_QUANTITY,
        unitOfMeasure: "kg",
      },
    });
  } else {
    await tx.billOfMaterials.create({
      data: {
        designId: design.id,
        rawMaterialId: rawMaterial.id,
        quantity: DEMO_TARGET_KG / DEMO_QUANTITY,
        unitOfMeasure: "kg",
      },
    });
  }

  let customer = await tx.customer.findFirst({
    where: { code: keys.customerCode },
  });

  if (customer) {
    customer = await tx.customer.update({
      where: { id: customer.id },
      data: {
        name: DEMO_CUSTOMER_NAME,
        contactName: "Demo buyer",
        phone: "+254 700 000 001",
      },
    });
  } else {
    customer = await tx.customer.create({
      data: {
        name: DEMO_CUSTOMER_NAME,
        code: keys.customerCode,
        contactName: "Demo buyer",
        phone: "+254 700 000 001",
      },
    });
  }

  let finishedGoods = await tx.finishedGoods.findFirst({
    where: { sku: keys.finishedGoodsSku },
  });

  if (finishedGoods) {
    finishedGoods = await tx.finishedGoods.update({
      where: { id: finishedGoods.id },
      data: {
        designId: design.id,
        quantity: 0,
        reservedQuantity: 0,
        kgProduced: 0,
        unitCost: DEMO_UNIT_PRICE,
      },
    });
  } else {
    finishedGoods = await tx.finishedGoods.create({
      data: {
        sku: keys.finishedGoodsSku,
        designId: design.id,
        quantity: 0,
        reservedQuantity: 0,
        kgProduced: 0,
        unitCost: DEMO_UNIT_PRICE,
      },
    });
  }

  return { keys, rawMaterial, design, customer, finishedGoods };
}

async function deleteExistingDemo(tx: TransactionClient, organizationId: string) {
  const keys = demoKeys(organizationId);

  await tx.productionOrder.deleteMany({
    where: { orderNumber: keys.productionOrderNumber },
  });
  await tx.saleOrder.deleteMany({
    where: { id: keys.saleOrderId },
  });
  await tx.finishedGoods.deleteMany({
    where: { sku: keys.finishedGoodsSku },
  });
}

async function createDemoFlow(tx: TransactionClient, user: { id: string; organizationId: string }) {
  const { keys, rawMaterial, design, customer, finishedGoods } = await ensureDemoFoundation(
    tx,
    user.organizationId,
  );

  const saleOrder = await tx.saleOrder.create({
    data: {
      id: keys.saleOrderId,
      customerId: customer.id,
      customerName: customer.name,
      totalAmount: DEMO_QUANTITY * DEMO_UNIT_PRICE,
      status: "PENDING",
      createdBy: user.id,
    },
  });

  const saleItem = await tx.saleItem.create({
    data: {
      saleOrderId: saleOrder.id,
      finishedGoodsId: finishedGoods.id,
      quantity: DEMO_QUANTITY,
      unitPrice: DEMO_UNIT_PRICE,
      totalPrice: DEMO_QUANTITY * DEMO_UNIT_PRICE,
    },
  });

  await tx.productionOrder.create({
    data: {
      orderNumber: keys.productionOrderNumber,
      designId: design.id,
      saleOrderId: saleOrder.id,
      saleItemId: saleItem.id,
      productName: DEMO_PRODUCT_NAME,
      quantity: DEMO_QUANTITY,
      expectedPieces: DEMO_QUANTITY,
      targetKg: DEMO_TARGET_KG,
      priority: "HIGH",
      status: "PENDING",
      currentStage: 1,
      currentDept: "Manager review",
      materials: {
        create: {
          organizationId: user.organizationId,
          rawMaterialId: rawMaterial.id,
          pieces: DEMO_QUANTITY,
          cutLength: 2.5,
          totalLength: DEMO_QUANTITY * 2.5,
          weightKg: DEMO_TARGET_KG,
        },
      },
    },
  });
}

async function getDemoProductionOrder(db: ReturnType<typeof getTenantPrisma>, organizationId: string) {
  const keys = demoKeys(organizationId);

  return db.productionOrder.findFirst({
    where: { orderNumber: keys.productionOrderNumber },
    include: {
      design: {
        include: {
          billOfMaterials: { select: { id: true } },
        },
      },
      materials: { select: { id: true } },
      saleOrder: {
        include: {
          createdByUser: { select: { name: true, email: true } },
          SaleItem: {
            include: {
              FinishedGoods: true,
            },
          },
        },
      },
      saleItem: {
        include: {
          FinishedGoods: true,
        },
      },
      StageLog: {
        orderBy: { sequence: "asc" },
        include: { User: { select: { name: true, email: true } } },
      },
    },
  });
}

function buildPhases(order: any | null, stages: ProductionFlowStage[]): DemoFlowPhase[] {
  const saleStatus = order?.saleOrder?.status ?? null;
  const productionStatus = order?.status ?? null;
  const productionDone = productionStatus === "COMPLETED";
  const fulfilled = saleStatus === "SHIPPED";
  const processDone = PROCESS_STAGE_KEYS.every((stageKey) =>
    stages.some((stage) => stage.key === stageKey && stage.status === "COMPLETED"),
  );

  return [
    {
      key: "sales",
      label: "Sales order",
      detail: order ? "Customer demand captured" : "Ready to create",
      status: order ? "DONE" : "ACTIVE",
    },
    {
      key: "request",
      label: "Production request",
      detail: productionStatus === "PENDING" ? "Awaiting release" : "Linked to the sale",
      status: !order ? "WAITING" : productionStatus === "PENDING" ? "ACTIVE" : "DONE",
    },
    {
      key: "stages",
      label: "Production stages",
      detail: processDone ? "Finished goods recorded" : "Shop floor route",
      status: !order || productionStatus === "PENDING"
        ? "WAITING"
        : productionDone
          ? "DONE"
          : "ACTIVE",
    },
    {
      key: "packaging",
      label: "Packaging",
      detail: fulfilled ? "Packed and dispatched" : "Finished goods handoff",
      status: fulfilled
        ? "DONE"
        : productionDone
          ? "ACTIVE"
          : "WAITING",
    },
    {
      key: "fulfilled",
      label: "Fulfilled",
      detail: fulfilled ? "Customer order shipped" : "Waiting on packaging",
      status: fulfilled ? "DONE" : "WAITING",
    },
  ];
}

function buildSnapshot(order: any | null): DemoFlowSnapshot {
  if (!order) {
    return {
      exists: false,
      isComplete: false,
      saleOrderId: null,
      productionOrderId: null,
      productionOrderNumber: null,
      customerName: DEMO_CUSTOMER_NAME,
      productName: DEMO_PRODUCT_NAME,
      quantity: DEMO_QUANTITY,
      totalAmount: DEMO_QUANTITY * DEMO_UNIT_PRICE,
      saleStatus: null,
      productionStatus: null,
      currentHandoff: "Sales",
      nextActionLabel: "Start demo flow",
      nextActionDetail: "Create the demo sales order and linked production request.",
      completedStages: 0,
      totalStages: 0,
      targetKg: DEMO_TARGET_KG,
      finishedKg: null,
      phases: buildPhases(null, []),
      stages: [],
    };
  }

  const stages = buildProductionFlow({
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
    actualWeightOut: order.actualWeightOut == null ? null : Number(order.actualWeightOut),
    materialCount: order.materials.length + (order.design?.billOfMaterials.length ?? 0),
    reviewerName: null,
    assignedOperatorName: null,
    outputRecorderName: null,
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
    operationLogs: [],
  });

  const completedStages = stages.filter((stage) => stage.status === "COMPLETED").length;
  const activeStage = stages.find((stage) => stage.status === "ACTIVE");
  const isComplete = order.saleOrder?.status === "SHIPPED";
  let nextActionLabel = "Replay demo";
  let nextActionDetail = "Reset this demo order and start again from sales.";

  if (order.status === "PENDING") {
    nextActionLabel = "Approve and release";
    nextActionDetail = "Approve the production request, reserve material, and start Cutting.";
  } else if (order.status === "IN_PRODUCTION" && activeStage) {
    nextActionLabel = `Complete ${activeStage.name}`;
    nextActionDetail = "Record the stage output and move the batch to the next department.";
  } else if (!isComplete && order.status === "COMPLETED") {
    nextActionLabel = "Package and fulfill";
    nextActionDetail = "Consume reserved finished goods and mark the customer order shipped.";
  }

  return {
    exists: true,
    isComplete,
    saleOrderId: order.saleOrderId,
    productionOrderId: order.id,
    productionOrderNumber: order.orderNumber,
    customerName: order.saleOrder?.customerName ?? DEMO_CUSTOMER_NAME,
    productName: order.design?.name ?? order.productName ?? DEMO_PRODUCT_NAME,
    quantity: order.quantity,
    totalAmount: Number(order.saleOrder?.totalAmount ?? DEMO_QUANTITY * DEMO_UNIT_PRICE),
    saleStatus: order.saleOrder?.status ?? null,
    productionStatus: order.status,
    currentHandoff: isComplete
      ? "Fulfilled"
      : activeStage?.department ?? order.currentDept ?? "Sales",
    nextActionLabel,
    nextActionDetail,
    completedStages,
    totalStages: stages.length,
    targetKg: Number(order.targetKg),
    finishedKg: order.actualWeightOut == null ? null : Number(order.actualWeightOut),
    phases: buildPhases(order, stages),
    stages,
  };
}

export async function getDemoFlowSnapshot(): Promise<DemoFlowSnapshot> {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);
  const order = await getDemoProductionOrder(db, user.organizationId);

  return buildSnapshot(order);
}

export async function startDemoFlow() {
  const user = await requireRole("ADMIN", "MANAGER");

  await withTenantTransaction(user.organizationId, async (tx) => {
    await deleteExistingDemo(tx, user.organizationId);
    await createDemoFlow(tx, user);
  }, { maxWait: 10000, timeout: 30000 });

  revalidateDemoPaths();
}

export async function resetDemoFlow() {
  await startDemoFlow();
}

async function approveAndReleaseDemoOrder(tx: TransactionClient, order: any, userId: string) {
  const keys = demoKeys(order.organizationId);
  const rawMaterial = await tx.rawMaterial.findFirst({
    where: { sku: keys.rawMaterialSku },
  });
  if (!rawMaterial) throw new Error("Demo raw material is missing");

  await tx.rawMaterial.update({
    where: { id: rawMaterial.id },
    data: {
      reservedKg: { increment: Number(order.targetKg) },
    },
  });

  await tx.productionOrder.update({
    where: { id: order.id },
    data: {
      status: "IN_PRODUCTION",
      approvedBy: userId,
      approvedAt: new Date(),
      productionStartedAt: new Date(),
      currentStage: 1,
      currentDept: getProductionFlowStageDefinition("cutting")?.department ?? "Cutting",
    },
  });
}

async function completeNextProductionStage(
  tx: TransactionClient,
  order: any,
  user: { id: string; organizationId: string },
) {
  const completedKeys = new Set(
    order.StageLog
      .map((log: any) => resolveProductionFlowStageKey(log.stageName) ?? resolveProductionFlowStageKey(log.department))
      .filter(Boolean),
  );
  const nextDefinition = PRODUCTION_FLOW_STAGE_DEFINITIONS.find((stage) =>
    PROCESS_STAGE_KEYS.includes(stage.key) && !completedKeys.has(stage.key),
  );

  if (!nextDefinition) throw new Error("Production stages are already complete");

  const previousLog = [...order.StageLog].reverse().find((log: any) => {
    const key = resolveProductionFlowStageKey(log.stageName) ?? resolveProductionFlowStageKey(log.department);
    return key && PROCESS_STAGE_KEYS.includes(key);
  });
  const kgIn = previousLog ? Number(previousLog.kgOut) : Number(order.targetKg);
  const script = STAGE_SCRIPT[nextDefinition.key] ?? { scrapKg: 0, notes: "Demo stage completed." };
  const kgScrap = Math.min(script.scrapKg, kgIn);
  const kgOut = nextDefinition.key === "electroplating" ? kgIn : kgIn - kgScrap;
  const stage = nextDefinition.key === "finished-goods"
    ? null
    : await tx.stage.findFirst({
        where: { designId: order.designId, sequence: nextDefinition.sequence },
      });

  await tx.stageLog.create({
    data: {
      orderId: order.id,
      stageId: stage?.id ?? null,
      stageName: nextDefinition.name,
      sequence: nextDefinition.sequence,
      kgIn,
      kgOut,
      kgScrap,
      scrapReason: kgScrap > 0 ? "PROCESS_LOSS" : null,
      department: nextDefinition.department,
      operatorId: user.id,
      notes: script.notes,
      completedAt: new Date(),
    },
  });

  const followingDefinition = PRODUCTION_FLOW_STAGE_DEFINITIONS.find(
    (stageDefinition) => stageDefinition.sequence === nextDefinition.sequence + 1,
  );

  if (nextDefinition.key !== "finished-goods") {
    await tx.productionOrder.update({
      where: { id: order.id },
      data: {
        currentStage: followingDefinition?.sequence ?? nextDefinition.sequence + 1,
        currentDept: followingDefinition?.department ?? null,
      },
    });
    return;
  }

  const keys = demoKeys(user.organizationId);
  const rawMaterial = await tx.rawMaterial.findFirst({
    where: { sku: keys.rawMaterialSku },
  });
  if (!rawMaterial) throw new Error("Demo raw material is missing");

  await tx.rawMaterial.update({
    where: { id: rawMaterial.id },
    data: {
      availableKg: { decrement: Number(order.targetKg) },
      reservedKg: { decrement: Math.min(Number(rawMaterial.reservedKg), Number(order.targetKg)) },
      availablePieces: { decrement: Math.min(rawMaterial.availablePieces, order.quantity) },
    },
  });

  await tx.materialConsumptionLog.create({
    data: {
      productionOrderId: order.id,
      rawMaterialId: rawMaterial.id,
      quantityConsumed: Number(order.targetKg),
      notes: "Demo material consumed when finished goods were recorded.",
    },
  });

  await tx.productionOrder.update({
    where: { id: order.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      productionFinishedAt: new Date(),
      outputRecordedAt: new Date(),
      outputRecordedBy: user.id,
      actualWeightOut: kgOut,
      actualPieces: order.quantity,
      currentStage: followingDefinition?.sequence ?? nextDefinition.sequence + 1,
      currentDept: followingDefinition?.department ?? "Packaging",
    },
  });

  if (order.saleItem?.FinishedGoods) {
    await tx.finishedGoods.update({
      where: { id: order.saleItem.finishedGoodsId },
      data: {
        quantity: { increment: order.quantity },
        kgProduced: { increment: kgOut },
      },
    });
  }

  if (order.saleOrderId) {
    const saleOrder = await tx.saleOrder.findFirst({
      where: { id: order.saleOrderId },
      include: { SaleItem: { include: { FinishedGoods: true } } },
    });
    if (!saleOrder) throw new Error("Linked demo sales order is missing");
    if (saleOrder.status === "PENDING") {
      await reserveSaleOrder(tx, saleOrder);
    }
  }
}

async function packageAndFulfillDemoOrder(
  tx: TransactionClient,
  order: any,
  user: { id: string; organizationId: string },
) {
  if (!order.saleOrderId) throw new Error("Demo production order is not linked to a sale");

  const saleOrder = await tx.saleOrder.findFirst({
    where: { id: order.saleOrderId },
    include: { SaleItem: { include: { FinishedGoods: true } } },
  });
  if (!saleOrder) throw new Error("Linked demo sales order is missing");

  const packagingDone = order.StageLog.some((log: any) =>
    resolveProductionFlowStageKey(log.stageName) === "packaging" ||
    resolveProductionFlowStageKey(log.department) === "packaging",
  );
  const kgIn = Number(order.actualWeightOut ?? order.targetKg);

  if (!packagingDone) {
    const packaging = getProductionFlowStageDefinition("packaging");
    if (!packaging) throw new Error("Packaging stage is not configured");

    await tx.stageLog.create({
      data: {
        orderId: order.id,
        stageId: null,
        stageName: packaging.name,
        sequence: packaging.sequence,
        kgIn,
        kgOut: kgIn,
        kgScrap: 0,
        scrapReason: null,
        department: packaging.department,
        operatorId: user.id,
        notes: "Demo packed, labeled, and released to dispatch.",
        completedAt: new Date(),
      },
    });
  }

  if (saleOrder.status === "CONFIRMED") {
    await consumeSaleOrderReservation(tx, saleOrder);
  }

  await tx.saleOrder.update({
    where: { id: saleOrder.id },
    data: { status: "SHIPPED" },
  });

  await tx.productionOrder.update({
    where: { id: order.id },
    data: {
      currentStage: getProductionFlowStageDefinition("packaging")?.sequence ?? 7,
      currentDept: PACKAGING_DISPATCHED_DEPT,
    },
  });
}

export async function advanceDemoFlow() {
  const user = await requireRole("ADMIN", "MANAGER");

  await withTenantTransaction(user.organizationId, async (tx) => {
    const keys = demoKeys(user.organizationId);
    let order = await tx.productionOrder.findFirst({
      where: { orderNumber: keys.productionOrderNumber },
      select: { id: true },
    });

    if (!order) {
      await deleteExistingDemo(tx, user.organizationId);
      await createDemoFlow(tx, user);
      return;
    }

    order = await tx.productionOrder.findFirst({
      where: { id: order.id },
      include: {
        saleOrder: {
          include: {
            SaleItem: { include: { FinishedGoods: true } },
          },
        },
        saleItem: {
          include: { FinishedGoods: true },
        },
        StageLog: { orderBy: { sequence: "asc" } },
      },
    });

    if (!order) throw new Error("Demo production order is missing");

    if (order.saleOrder?.status === "SHIPPED") return;

    if (order.status === "PENDING") {
      await approveAndReleaseDemoOrder(tx, order, user.id);
      return;
    }

    if (order.status === "IN_PRODUCTION") {
      await completeNextProductionStage(tx, order, user);
      return;
    }

    if (order.status === "COMPLETED") {
      await packageAndFulfillDemoOrder(tx, order, user);
      return;
    }
  }, { maxWait: 10000, timeout: 30000 });

  revalidateDemoPaths();
}
