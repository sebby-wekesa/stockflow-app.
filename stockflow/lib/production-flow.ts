export type ProductionFlowStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "BLOCKED"
  | "REJECTED";

export type ProductionFlowStage = {
  key: string;
  name: string;
  department: string;
  status: ProductionFlowStatus;
  kgIn: number | null;
  kgOut: number | null;
  kgScrap: number | null;
  assignedOperator: string | null;
  completedAt: Date | null;
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

type StageDefinition = {
  key: string;
  name: string;
  department: string;
  aliases: string[];
};

const PROCESS_DEFINITIONS: StageDefinition[] = [
  {
    key: "cutting",
    name: "Cutting",
    department: "Cutting",
    aliases: ["cutting"],
  },
  {
    key: "forging-chamfering",
    name: "Forging / Chamfering",
    department: "Forging / Chamfering",
    aliases: ["forging", "chamfer", "chamfering"],
  },
  {
    key: "threading-locking",
    name: "Threading / Locking",
    department: "Threading / Locking",
    aliases: ["threading", "locking"],
  },
  {
    key: "electroplating",
    name: "Electroplating",
    department: "Electroplating",
    aliases: ["electroplating", "electro plating", "plating"],
  },
  {
    key: "drilling-grinding",
    name: "Drilling / Grinding",
    department: "Drilling / Grinding",
    aliases: ["drilling", "grinding"],
  },
];

function emptyStage(
  key: string,
  name: string,
  department: string,
  status: ProductionFlowStatus = "PENDING",
): ProductionFlowStage {
  return {
    key,
    name,
    department,
    status,
    kgIn: null,
    kgOut: null,
    kgScrap: null,
    assignedOperator: null,
    completedAt: null,
  };
}

function normalise(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[_-]+/g, " ") ?? "";
}

function matchesDefinition(value: string | null, definition: StageDefinition) {
  const candidate = normalise(value);
  return definition.aliases.some((alias) => candidate.includes(normalise(alias)));
}

function buildProcessStage(
  definition: StageDefinition,
  input: ProductionFlowInput,
): ProductionFlowStage {
  const logs = input.stageLogs.filter(
    (log) =>
      matchesDefinition(log.stageName, definition) ||
      matchesDefinition(log.department, definition),
  );
  const operations = input.operationLogs.filter((operation) =>
    matchesDefinition(operation.name, definition),
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
    (matchesDefinition(input.currentDept, definition) && status !== "COMPLETED")
  ) {
    status = "ACTIVE";
  }

  return {
    key: definition.key,
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
  finishedGoods.kgIn = latestStageLog?.kgOut ?? input.actualWeightOut;
  finishedGoods.kgOut = input.actualWeightOut ?? latestStageLog?.kgOut ?? null;
  finishedGoods.kgScrap = isCompleted ? 0 : null;
  finishedGoods.assignedOperator =
    input.outputRecorderName ??
    latestStageLog?.operatorName ??
    latestCompletedOperation?.operatorName ??
    null;
  finishedGoods.completedAt = isCompleted
    ? input.completedAt ?? input.productionFinishedAt ?? input.outputRecordedAt
    : null;

  const packaging = emptyStage("packaging", "Packaging", "Packaging");
  const currentDepartment = normalise(input.currentDept);
  const saleStatus = input.saleOrder?.status;
  if (isRejected || isCancelled || saleStatus === "CANCELLED") {
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
    (isCompleted && saleStatus === "CONFIRMED")
  ) {
    packaging.status = "ACTIVE";
  }
  packaging.kgIn = isCompleted ? finishedGoods.kgOut : null;
  packaging.kgOut = packaging.status === "COMPLETED" ? finishedGoods.kgOut : null;
  packaging.kgScrap = packaging.status === "COMPLETED" ? 0 : null;

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
