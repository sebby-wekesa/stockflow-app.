import { requireRole } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import {
  getBalanceSheet,
  getFinancialInsights,
  getProfitAndLoss,
} from "./accounting-reports";

jest.mock("@/lib/auth", () => ({
  requireRole: jest.fn(),
}));

jest.mock("@/lib/tenant-prisma", () => ({
  getTenantPrisma: jest.fn(),
}));

const mockedRequireRole = jest.mocked(requireRole);
const mockedGetTenantPrisma = jest.mocked(getTenantPrisma);

function reportDb({
  accounts = [],
  lines = [],
  sales = [],
}: {
  accounts?: object[];
  lines?: object[];
  sales?: object[];
} = {}) {
  return {
    chartAccount: {
      findMany: jest.fn().mockResolvedValue(accounts),
    },
    ledgerLine: {
      findMany: jest.fn().mockResolvedValue(lines),
    },
    saleOrder: {
      findMany: jest.fn().mockResolvedValue(sales),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedRequireRole.mockResolvedValue({ organizationId: "org-1" } as never);
});

test("builds profit and loss from posted ledger movements for the full date range", async () => {
  const db = reportDb({
    accounts: [
      {
        id: "sales",
        code: "4000",
        name: "Sales Revenue",
        type: "INCOME",
        description: "key:sales_revenue",
      },
      {
        id: "cost",
        code: "5050",
        name: "Direct Materials",
        type: "EXPENSE",
        description: "key:cost_of_sales",
      },
      {
        id: "rent",
        code: "5200",
        name: "Rent",
        type: "EXPENSE",
        description: null,
      },
    ],
    lines: [
      { accountId: "sales", debit: 0, credit: 1_000 },
      { accountId: "cost", debit: 400, credit: 0 },
      { accountId: "rent", debit: 100, credit: 0 },
    ],
  });
  mockedGetTenantPrisma.mockReturnValue(db as never);

  const report = await getProfitAndLoss({
    from: "2026-06-01",
    to: "2026-06-30",
  });

  expect(mockedRequireRole).toHaveBeenCalledWith(
    "ADMIN",
    "MANAGER",
    "ACCOUNTS",
  );
  expect(db.ledgerLine.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        journalEntry: {
          status: "POSTED",
          date: {
            gte: new Date("2026-06-01T00:00:00.000Z"),
            lte: new Date("2026-06-30T23:59:59.999Z"),
          },
        },
      },
    }),
  );
  expect(report).toEqual(
    expect.objectContaining({
      totalIncome: 1_000,
      costOfSales: 400,
      grossProfit: 600,
      totalOperatingExpenses: 100,
      totalExpenses: 500,
      netProfit: 500,
      grossMargin: 60,
      netMargin: 50,
    }),
  );
  expect(report.expenses).toEqual([
    { code: "5200", name: "Rent", amount: 100 },
  ]);
});

test("folds unclosed earnings into equity so the balance sheet balances", async () => {
  const db = reportDb({
    accounts: [
      { id: "cash", code: "1000", name: "Cash", type: "ASSET" },
      { id: "payable", code: "2000", name: "Payable", type: "LIABILITY" },
      { id: "capital", code: "3000", name: "Capital", type: "EQUITY" },
      { id: "sales", code: "4000", name: "Sales", type: "INCOME" },
      { id: "rent", code: "5200", name: "Rent", type: "EXPENSE" },
    ],
    lines: [
      { accountId: "cash", debit: 1_000, credit: 0 },
      { accountId: "payable", debit: 0, credit: 200 },
      { accountId: "capital", debit: 0, credit: 500 },
      { accountId: "sales", debit: 0, credit: 400 },
      { accountId: "rent", debit: 100, credit: 0 },
    ],
  });
  mockedGetTenantPrisma.mockReturnValue(db as never);

  const report = await getBalanceSheet({ asOf: "2026-06-30" });

  expect(report.totalAssets).toBe(1_000);
  expect(report.totalLiabilitiesAndEquity).toBe(1_000);
  expect(report.balanced).toBe(true);
  expect(report.equity).toContainEqual({
    code: "-",
    name: "Unclosed Earnings",
    amount: 300,
  });
});

test("calculates customer concentration from confirmed sales in the selected period", async () => {
  const db = reportDb({
    sales: [
      {
        customerId: "customer-1",
        customerName: "Alpha",
        totalAmount: 750,
      },
      {
        customerId: "customer-2",
        customerName: "Beta",
        totalAmount: 250,
      },
    ],
  });
  mockedGetTenantPrisma.mockReturnValue(db as never);

  const insights = await getFinancialInsights({
    from: "2026-06-01",
    to: "2026-06-30",
  });

  expect(db.saleOrder.findMany).toHaveBeenCalledWith({
    where: {
      status: { in: ["CONFIRMED", "READY_FOR_DISPATCH", "SHIPPED"] },
      createdAt: {
        gte: new Date("2026-06-01T00:00:00.000Z"),
        lte: new Date("2026-06-30T23:59:59.999Z"),
      },
    },
    select: { customerId: true, customerName: true, totalAmount: true },
  });
  expect(insights).toEqual(
    expect.objectContaining({
      totalSales: 1_000,
      customerCount: 2,
      concentrationRisk: "HIGH",
      topCustomer: {
        key: "customer-1",
        name: "Alpha",
        amount: 750,
        share: 75,
      },
    }),
  );
});

test("rejects an invalid report range", async () => {
  mockedGetTenantPrisma.mockReturnValue(reportDb() as never);

  await expect(
    getProfitAndLoss({ from: "2026-07-01", to: "2026-06-30" }),
  ).rejects.toThrow("Report start date must be before end date");
});
