export type ProductionFlowStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "BLOCKED"
  | "REJECTED";

export type ProductionFlowStage = {
  key: string;
  sequence: number | null;
  name: string;
  department: string;
  status: ProductionFlowStatus;
  kgIn: number | null;
  kgOut: number | null;
  kgScrap: number | null;
  assignedOperator: string | null;
  completedAt: Date | null;
  canComplete: boolean;
};

type StageEvidence = {
  stageName: string;
  department: string | null;
  kgIn: number;
  kgOut: number;
  kgScrap: number;
  operatorName: string | null;
  completedAt: Date;
};

type OperationEvidence = {
  name: string;
  status: string;
  operatorName: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type ProductionFlowInput = {
  status: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  completedAt: Date | null;
  productionStartedAt: Date | null;
  productionFinishedAt: Date | null;
  outputRecordedAt: Date | null;
  currentDept: string | null;
  targetKg: number;
  actualWeightOut: number | null;
  materialCount: number;
  reviewerName: string | null;
  assignedOperatorName: string | null;
  outputRecorderName: string | null;
  saleOrder: {
    status: string;
    createdAt: Date;
    updatedAt: Date;
    operatorName: string | null;
  } | null;
  stageLogs: StageEvidence[];
  operationLogs: OperationEvidence[];
};

export type ProductionFlowStageDefinition = {
  key: string;
  sequence: number;
  name: string;
  department: string;
  aliases: string[];
};

export const PRODUCTION_FLOW_STAGE_DEFINITIONS: ProductionFlowStageDefinition[] = [
  {
    key: "cutting",
    sequence: 1,
    name: "Cutting",
    department: "Cutting",
    aliases: ["cutting"],
  },
  {
    key: "forging-chamfering",
    sequence: 2,
    name: "Forging / Chamfering",
    department: "Forging / Chamfering",
    aliases: ["forging", "chamfer", "chamfering"],
  },
  {
    key: "threading-locking",
    sequence: 3,
    name: "Threading / Locking",
    department: "Threading / Locking",
    aliases: ["threading", "locking"],
  },
  {
    key: "electroplating",
    sequence: 4,
    name: "Electroplating",
    department: "Electroplating",
    aliases: ["electroplating", "electro plating", "plating"],
  },
  {
    key: "drilling-grinding",
    sequence: 5,
    name: "Drilling / Grinding",
    department: "Drilling / Grinding",
    aliases: ["drilling", "grinding"],
  },
  {
    key: "finished-goods",
    sequence: 6,
    name: "Finished Goods",
    department: "Finished Goods",
    aliases: ["finished goods"],
  },
  {
    key: "packaging",
    sequence: 7,
    name: "Packaging",
    department: "Packaging",
    aliases: ["packaging"],
  },
];

const PROCESS_DEFINITIONS = PRODUCTION_FLOW_STAGE_DEFINITIONS.slice(0, 5);

function emptyStage(
  key: string,
  name: string,
  department: string,
  status: ProductionFlowStatus = "PENDING",
): ProductionFlowStage {
  return {
    key,
    sequence: null,
    name,
    department,
    status,
    kgIn: null,
    kgOut: null,
    kgScrap: null,
    assignedOperator: null,
    completedAt: null,
    canComplete: false,
  };
}

function normalise(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[_-]+/g, " ") ?? "";
}

export function matchesProductionFlowStage(
  value: string | null,
  definition: ProductionFlowStageDefinition,
) {
  const candidate = normalise(value);
  return definition.aliases.some((alias) => candidate.includes(normalise(alias)));
}

export function getProductionFlowStageDefinition(stageKey: string) {
  return PRODUCTION_FLOW_STAGE_DEFINITIONS.find((definition) => definition.key === stageKey);
}

export function resolveProductionFlowStageKey(value: string | null) {
  return PRODUCTION_FLOW_STAGE_DEFINITIONS.find((definition) =>
    matchesProductionFlowStage(value, definition),
  )?.key ?? null;
}

function buildProcessStage(
  definition: ProductionFlowStageDefinition,
  input: ProductionFlowInput,
): ProductionFlowStage {
  const logs = input.stageLogs.filter(
    (log) =>
      matchesProductionFlowStage(log.stageName, definition) ||
      matchesProductionFlowStage(log.department, definition),
  );
  const operations = input.operationLogs.filter((operation) =>
    matchesProductionFlowStage(operation.name, definition),
  );
  const latestLog = logs.at(-1);
  const latestOperation = operations.at(-1);
  const activeOperation = operations.find((operation) => operation.status === "IN_PROGRESS");
  const completedOperation = [...operations]
    .reverse()
    .find((operation) => operation.status === "DONE");

  let status: ProductionFlowStatus = "PENDING";
  if (logs.length > 0 || completedOperation) status = "COMPLETED";
  if (
    activeOperation ||
    (matchesProductionFlowStage(input.currentDept, definition) && status !== "COMPLETED")
  ) {
    status = "ACTIVE";
  }

  return {
    key: definition.key,
    sequence: definition.sequence,
    name: definition.name,
    department: latestLog?.department || definition.department,
    status,
    kgIn: logs.length > 0 ? logs[0].kgIn : null,
    kgOut: latestLog?.kgOut ?? null,
    kgScrap:
      logs.length > 0
        ? logs.reduce((total, log) => total + log.kgScrap, 0)
        : null,
    assignedOperator:
      latestLog?.operatorName ??
      activeOperation?.operatorName ??
      latestOperation?.operatorName ??
      input.assignedOperatorName,
    completedAt:
      latestLog?.completedAt ?? completedOperation?.completedAt ?? null,
    canComplete: false,
  };
}

function blockStages(stages: ProductionFlowStage[]) {
  return stages.map((stage) => ({ ...stage, status: "BLOCKED" as const }));
}

export function buildProductionFlow(input: ProductionFlowInput): ProductionFlowStage[] {
  const isRejected = input.status === "REJECTED";
  const isCancelled = input.status === "CANCELLED";
  const isReleased = Boolean(input.approvedAt) ||
    ["APPROVED", "IN_PRODUCTION", "COMPLETED"].includes(input.status);
  const isCompleted = input.status === "COMPLETED";

  const salesOrder = emptyStage("sales-order", "Sales Order", "Sales", "COMPLETED");
  salesOrder.assignedOperator = input.saleOrder?.operatorName ?? null;
  salesOrder.completedAt = input.saleOrder?.createdAt ?? input.createdAt;
  if (input.saleOrder?.status === "CANCELLED") salesOrder.status = "REJECTED";

  const managerReview = emptyStage(
    "manager-review",
    "Manager Review",
    "Management",
    input.status === "PENDING"
      ? "ACTIVE"
      : isRejected
        ? "REJECTED"
        : isCancelled
          ? "BLOCKED"
          : "COMPLETED",
  );
  managerReview.assignedOperator = input.reviewerName;
  managerReview.completedAt = isRejected
    ? input.updatedAt
    : input.approvedAt;

  const released = emptyStage(
    "production-order-released",
    "Production Order Released",
    "Production Control",
    isRejected || isCancelled ? "BLOCKED" : isReleased ? "COMPLETED" : "PENDING",
  );
  released.assignedOperator = input.reviewerName;
  released.completedAt = isReleased ? input.approvedAt : null;

  const materialsReserved = emptyStage(
    "materials-reserved",
    "Materials Reserved",
    "Warehouse",
  );
  materialsReserved.assignedOperator = input.assignedOperatorName;
  if (isRejected || isCancelled) {
    materialsReserved.status = "BLOCKED";
  } else if (isReleased && (input.materialCount > 0 || input.targetKg > 0)) {
    materialsReserved.status = "COMPLETED";
    materialsReserved.kgIn = input.targetKg;
    materialsReserved.kgOut = input.targetKg;
    materialsReserved.kgScrap = 0;
    materialsReserved.completedAt = input.approvedAt;
  } else if (isReleased) {
    materialsReserved.status = "BLOCKED";
  }

  let processStages = PROCESS_DEFINITIONS.map((definition) =>
    buildProcessStage(definition, input),
  );

  if (isRejected || isCancelled) {
    processStages = blockStages(processStages);
  } else if (isCompleted) {
    processStages = processStages.map((stage) => ({
      ...stage,
      status: "COMPLETED",
      completedAt:
        stage.completedAt ?? input.productionFinishedAt ?? input.completedAt,
    }));
  } else if (input.status === "IN_PRODUCTION") {
    const activeIndex = processStages.findIndex((stage) => stage.status === "ACTIVE");
    const nextIndex = activeIndex >= 0
      ? activeIndex
      : processStages.findIndex((stage) => stage.status !== "COMPLETED");

    if (nextIndex >= 0) {
      processStages = processStages.map((stage, index) => {
        if (index < nextIndex && stage.status === "PENDING") {
          return {
            ...stage,
            status: "COMPLETED",
            completedAt: input.productionStartedAt ?? input.approvedAt,
          };
        }
        if (index === nextIndex && stage.status === "PENDING") {
          return { ...stage, status: "ACTIVE" };
        }
        return stage;
      });
    }
  }

  let inheritedKg: number | null = materialsReserved.kgOut ?? input.targetKg;
  processStages = processStages.map((stage) => {
    const kgIn = stage.kgIn ?? (stage.status === "ACTIVE" ? inheritedKg : null);
    if (stage.kgOut != null) inheritedKg = stage.kgOut;
    return {
      ...stage,
      kgIn,
      canComplete: stage.status === "ACTIVE",
    };
  });

  const latestStageLog = input.stageLogs.at(-1);
  const latestCompletedOperation = [...input.operationLogs]
    .reverse()
    .find((operation) => operation.status === "DONE");

  const finishedGoods = emptyStage(
    "finished-goods",
    "Finished Goods",
    "Finished Goods",
    isRejected || isCancelled ? "BLOCKED" : isCompleted ? "COMPLETED" : "PENDING",
  );
  const finishedGoodsDefinition = getProductionFlowStageDefinition("finished-goods")!;
  const finishedGoodsLog = input.stageLogs.find((log) =>
    matchesProductionFlowStage(log.stageName, finishedGoodsDefinition),
  );
  const productionStagesComplete = processStages.every((stage) => stage.status === "COMPLETED");
  finishedGoods.sequence = finishedGoodsDefinition.sequence;
  finishedGoods.status = finishedGoodsLog
    ? "COMPLETED"
    : isRejected || isCancelled
      ? "BLOCKED"
      : isCompleted
        ? "COMPLETED"
        : input.status === "IN_PRODUCTION" && productionStagesComplete
          ? "ACTIVE"
          : "PENDING";
  finishedGoods.kgIn =
    finishedGoodsLog?.kgIn ??
    latestStageLog?.kgOut ??
    inheritedKg ??
    input.actualWeightOut;
  finishedGoods.kgOut =
    finishedGoodsLog?.kgOut ??
    input.actualWeightOut ??
    (isCompleted ? latestStageLog?.kgOut ?? null : null);
  finishedGoods.kgScrap = finishedGoodsLog?.kgScrap ?? (isCompleted ? 0 : null);
  finishedGoods.assignedOperator =
    finishedGoodsLog?.operatorName ??
    input.outputRecorderName ??
    latestStageLog?.operatorName ??
    latestCompletedOperation?.operatorName ??
    null;
  finishedGoods.completedAt =
    finishedGoodsLog?.completedAt ??
    (isCompleted ? input.completedAt ?? input.productionFinishedAt ?? input.outputRecordedAt : null);
  finishedGoods.canComplete = finishedGoods.status === "ACTIVE";

  const packaging = emptyStage("packaging", "Packaging", "Packaging");
  const packagingDefinition = getProductionFlowStageDefinition("packaging")!;
  const packagingLog = input.stageLogs.find((log) =>
    matchesProductionFlowStage(log.stageName, packagingDefinition),
  );
  const currentDepartment = normalise(input.currentDept);
  const saleStatus = input.saleOrder?.status;
  packaging.sequence = packagingDefinition.sequence;
  if (packagingLog) {
    packaging.status = "COMPLETED";
    packaging.completedAt = packagingLog.completedAt;
    packaging.assignedOperator = packagingLog.operatorName;
  } else if (isRejected || isCancelled || saleStatus === "CANCELLED") {
    packaging.status = "BLOCKED";
  } else if (
    currentDepartment === "ready for dispatch" ||
    currentDepartment === "dispatched" ||
    saleStatus === "READY_FOR_DISPATCH" ||
    saleStatus === "SHIPPED"
  ) {
    packaging.status = "COMPLETED";
    packaging.completedAt = input.saleOrder?.updatedAt ?? input.updatedAt;
  } else if (
    currentDepartment === "packaging" ||
    isCompleted
  ) {
    packaging.status = "ACTIVE";
  }
  packaging.kgIn = packagingLog?.kgIn ?? (isCompleted ? finishedGoods.kgOut : null);
  packaging.kgOut = packagingLog?.kgOut ?? (
    packaging.status === "COMPLETED" ? finishedGoods.kgOut : null
  );
  packaging.kgScrap = packagingLog?.kgScrap ?? (
    packaging.status === "COMPLETED" ? 0 : null
  );
  packaging.canComplete = packaging.status === "ACTIVE";

  return [
    salesOrder,
    managerReview,
    released,
    materialsReserved,
    ...processStages,
    finishedGoods,
    packaging,
  ];
}
