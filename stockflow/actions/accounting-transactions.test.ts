import { requireRole } from "@/lib/auth";
import { withTenantTransaction } from "@/lib/tenant-prisma";
import { postBill, postExpense, postTransfer } from "./accounting-transactions";

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  requireRole: jest.fn(),
}));

jest.mock("@/lib/tenant-prisma", () => ({
  getTenantPrisma: jest.fn(),
  withTenantTransaction: jest.fn(),
}));

const mockedRequireRole = jest.mocked(requireRole);
const mockedWithTenantTransaction = jest.mocked(withTenantTransaction);

function transactionDb(account: {
  id: string;
  type: string;
  isBank: boolean;
  normalBalance: string;
}) {
  return {
    chartAccount: {
      findFirst: jest.fn().mockResolvedValue(account),
      findMany: jest.fn().mockResolvedValue([
        { id: "cash", description: "key:cash_on_hand" },
        { id: "receivable", description: "key:accounts_receivable" },
        { id: "payable", description: "key:accounts_payable" },
        { id: "vat-input", description: "key:vat_input" },
      ]),
    },
    bankAccount: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    journalEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedRequireRole.mockResolvedValue({
    id: "user-1",
    organizationId: "org-1",
  } as never);
});

test("restricts transaction actions to accounting roles", async () => {
  const db = transactionDb({
    id: "asset",
    type: "ASSET",
    isBank: false,
    normalBalance: "DEBIT",
  });
  mockedWithTenantTransaction.mockImplementation(async (_organizationId, fn) =>
    fn(db as never),
  );

  await postExpense({
    date: "2026-06-15",
    amount: 100,
    expenseAccountId: "asset",
  });

  expect(mockedRequireRole).toHaveBeenCalledWith(
    "ADMIN",
    "MANAGER",
    "ACCOUNTS",
  );
});

test("rejects an expense posted to a non-expense account", async () => {
  const db = transactionDb({
    id: "asset",
    type: "ASSET",
    isBank: false,
    normalBalance: "DEBIT",
  });
  mockedWithTenantTransaction.mockImplementation(async (_organizationId, fn) =>
    fn(db as never),
  );

  const result = await postExpense({
    date: "2026-06-15",
    amount: 100,
    expenseAccountId: "asset",
  });

  expect(result).toEqual({
    success: false,
    error: "Pick a valid expense account from your organization",
  });
  expect(db.journalEntry.create).not.toHaveBeenCalled();
});

test("rejects an invalid requested bank instead of falling back to cash", async () => {
  const db = transactionDb({
    id: "expense",
    type: "EXPENSE",
    isBank: false,
    normalBalance: "DEBIT",
  });
  mockedWithTenantTransaction.mockImplementation(async (_organizationId, fn) =>
    fn(db as never),
  );

  const result = await postExpense({
    date: "2026-06-15",
    amount: 100,
    expenseAccountId: "expense",
    bankAccountId: "other-org-bank",
  });

  expect(result).toEqual({
    success: false,
    error: "Bank account not found in your organization",
  });
  expect(db.journalEntry.create).not.toHaveBeenCalled();
});

test("rejects cash and bank accounts as a bill purchase account", async () => {
  const db = transactionDb({
    id: "bank-gl",
    type: "ASSET",
    isBank: true,
    normalBalance: "DEBIT",
  });
  mockedWithTenantTransaction.mockImplementation(async (_organizationId, fn) =>
    fn(db as never),
  );

  const result = await postBill({
    date: "2026-06-15",
    amount: 100,
    purchaseAccountId: "bank-gl",
  });

  expect(result).toEqual({
    success: false,
    error: "Pick a valid expense or asset account from your organization",
  });
});

test("rejects transfers involving a non-bank asset account", async () => {
  const db = transactionDb({
    id: "inventory",
    type: "ASSET",
    isBank: false,
    normalBalance: "DEBIT",
  });
  mockedWithTenantTransaction.mockImplementation(async (_organizationId, fn) =>
    fn(db as never),
  );

  const result = await postTransfer({
    date: "2026-06-15",
    amount: 100,
    fromAccountId: "inventory",
    toAccountId: "bank-gl",
  });

  expect(result).toEqual({
    success: false,
    error: "Pick a valid source cash or bank account from your organization",
  });
});
