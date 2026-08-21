import { requireRole } from "@/lib/auth";
import { withTenantTransaction } from "@/lib/tenant-prisma";
import { postJournalEntry } from "@/lib/accounting/posting";
import { postPayroll } from "./accounting-payroll";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth", () => ({ requireRole: jest.fn() }));
jest.mock("@/lib/tenant-prisma", () => ({
  getTenantPrisma: jest.fn(),
  withTenantTransaction: jest.fn(),
}));
jest.mock("@/lib/accounting/posting", () => ({
  SYSTEM_ACCOUNT_KEYS: {
    EMPLOYEE_RECEIVABLES: "employee_receivables",
    EMPLOYEE_PAYABLES: "employee_payables",
    SALARIES_WAGES: "salaries_wages",
    PAYE_PAYABLE: "paye_payable",
    NSSF_PAYABLE: "nssf_payable",
    SHIF_PAYABLE: "shif_payable",
    HOUSING_LEVY_PAYABLE: "housing_levy_payable",
    NITA_PAYABLE: "nita_payable",
  },
  getSystemAccounts: jest.fn(),
  postJournalEntry: jest.fn(),
}));

const mockedRequireRole = jest.mocked(requireRole);
const mockedWithTenantTransaction = jest.mocked(withTenantTransaction);
const mockedPostJournalEntry = jest.mocked(postJournalEntry);

const accountIds = {
  employee_receivables: "employee-receivables",
  employee_payables: "employee-payables",
  salaries_wages: "salaries-wages",
  paye_payable: "paye",
  nssf_payable: "nssf",
  shif_payable: "shif",
  housing_levy_payable: "housing",
  nita_payable: "nita",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedRequireRole.mockResolvedValue({ id: "accounts-1", organizationId: "org-1" } as never);
  mockedPostJournalEntry.mockResolvedValue({ id: "journal-1", entryNumber: "JE-2026-000001" });
  const db = {
    payrollRun: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "run-1" }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: "employee-1", name: "Amina", email: "amina@example.com" }]),
    },
    chartAccount: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { code: string } }) =>
        Promise.resolve({
          id: where.code === "5100" ? accountIds.salaries_wages : accountIds[where.code as keyof typeof accountIds] ?? where.code,
          type: where.code === "5100" || where.code === "1210" ? (where.code === "5100" ? "EXPENSE" : "ASSET") : "LIABILITY",
          normalBalance: where.code === "5100" || where.code === "1210" ? "DEBIT" : "CREDIT",
          isActive: true,
          isSystem: true,
          description: `key:${where.code}`,
        })),
      update: jest.fn(),
      create: jest.fn(),
    },
    payrollEntry: { createMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  mockedWithTenantTransaction.mockImplementation(async (organizationId, fn) => {
    expect(organizationId).toBe("org-1");
    return fn(db as never);
  });
  const posting = jest.requireMock("@/lib/accounting/posting") as { getSystemAccounts: jest.Mock };
  posting.getSystemAccounts.mockResolvedValue(accountIds);
});

test("restricts payroll posting and posts a balanced journal for the tenant", async () => {
  const result = await postPayroll({
    period: "2026-08",
    payDate: "2026-08-31",
    rows: [{ employeeId: "employee-1", basicSalary: 100000, nita: 100, advanceLoan: 5000 }],
  });

  expect(result).toMatchObject({ success: true, entryNumber: "JE-2026-000001" });
  expect(mockedRequireRole).toHaveBeenCalledWith("ADMIN", "MANAGER", "ACCOUNTS");
  expect(mockedPostJournalEntry).toHaveBeenCalledWith(
    expect.anything(),
    "org-1",
    expect.objectContaining({ sourceType: "Payroll", sourceId: "run-1" }),
    "accounts-1",
  );
  const journal = mockedPostJournalEntry.mock.calls[0][2];
  expect(journal.lines.reduce((sum, line) => sum + (line.debit ?? 0), 0)).toBe(
    journal.lines.reduce((sum, line) => sum + (line.credit ?? 0), 0),
  );
});

test("rejects duplicate employees in a payroll run", async () => {
  const result = await postPayroll({
    period: "2026-08",
    payDate: "2026-08-31",
    rows: [
      { employeeId: "employee-1", basicSalary: 100000 },
      { employeeId: "employee-1", basicSalary: 90000 },
    ],
  });

  expect(result).toEqual({ success: false, error: "An employee can only appear once in a payroll run" });
  expect(mockedWithTenantTransaction).not.toHaveBeenCalled();
});
