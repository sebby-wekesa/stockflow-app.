import {
  buildProductionFlow,
  type ProductionFlowInput,
} from "./production-flow";

const createdAt = new Date("2026-06-01T08:00:00.000Z");
const approvedAt = new Date("2026-06-01T09:00:00.000Z");
const completedAt = new Date("2026-06-02T15:00:00.000Z");

function input(overrides: Partial<ProductionFlowInput> = {}): ProductionFlowInput {
  return {
    status: "PENDING",
    createdAt,
    updatedAt: createdAt,
    approvedAt: null,
    completedAt: null,
    productionStartedAt: null,
    productionFinishedAt: null,
    outputRecordedAt: null,
    currentDept: null,
    targetKg: 100,
    actualWeightOut: null,
    materialCount: 1,
    reviewerName: null,
    assignedOperatorName: null,
    outputRecorderName: null,
    saleOrder: null,
    stageLogs: [],
    operationLogs: [],
    ...overrides,
  };
}

function statusMap(flow: ReturnType<typeof buildProductionFlow>) {
  return Object.fromEntries(flow.map((stage) => [stage.key, stage.status]));
}

test("shows pending production orders at manager review", () => {
  const flow = buildProductionFlow(input());

  expect(statusMap(flow)).toMatchObject({
    "sales-order": "COMPLETED",
    "manager-review": "ACTIVE",
    "production-order-released": "PENDING",
    "materials-reserved": "PENDING",
    cutting: "PENDING",
    packaging: "PENDING",
  });
});

test("rejects manager review and blocks downstream stages", () => {
  const flow = buildProductionFlow(input({
    status: "REJECTED",
    updatedAt: approvedAt,
  }));

  expect(flow.find((stage) => stage.key === "manager-review")).toMatchObject({
    status: "REJECTED",
    completedAt: approvedAt,
  });
  expect(
    flow
      .filter((stage) => stage.key !== "sales-order" && stage.key !== "manager-review")
      .every((stage) => stage.status === "BLOCKED"),
  ).toBe(true);
});

test("uses stage logs for kg, operator, timestamp, and active department", () => {
  const cuttingCompletedAt = new Date("2026-06-01T11:00:00.000Z");
  const flow = buildProductionFlow(input({
    status: "IN_PRODUCTION",
    approvedAt,
    productionStartedAt: approvedAt,
    currentDept: "Forging",
    reviewerName: "Manager One",
    stageLogs: [{
      stageName: "Cutting",
      department: "Cutting",
      kgIn: 100,
      kgOut: 96,
      kgScrap: 4,
      operatorName: "Operator One",
      completedAt: cuttingCompletedAt,
    }],
  }));

  expect(flow.find((stage) => stage.key === "cutting")).toMatchObject({
    status: "COMPLETED",
    kgIn: 100,
    kgOut: 96,
    kgScrap: 4,
    assignedOperator: "Operator One",
    completedAt: cuttingCompletedAt,
  });
  expect(flow.find((stage) => stage.key === "forging-chamfering")).toMatchObject({
    status: "ACTIVE",
  });
});

test("shows completed production through shipped packaging", () => {
  const flow = buildProductionFlow(input({
    status: "COMPLETED",
    approvedAt,
    completedAt,
    productionFinishedAt: completedAt,
    actualWeightOut: 92,
    saleOrder: {
      status: "SHIPPED",
      createdAt,
      updatedAt: completedAt,
      operatorName: "Sales One",
    },
  }));

  expect(
    flow
      .filter((stage) =>
        ["cutting", "forging-chamfering", "threading-locking", "electroplating", "drilling-grinding"]
          .includes(stage.key),
      )
      .every((stage) => stage.status === "COMPLETED"),
  ).toBe(true);
  expect(flow.find((stage) => stage.key === "finished-goods")).toMatchObject({
    status: "COMPLETED",
    kgOut: 92,
  });
  expect(flow.find((stage) => stage.key === "packaging")).toMatchObject({
    status: "COMPLETED",
    kgIn: 92,
    kgOut: 92,
    completedAt,
  });
});
