"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  alreadyPosted,
  getSystemAccounts,
  postJournalEntry,
  SYSTEM_ACCOUNT_KEYS,
  type PostJournalInput,
} from "@/lib/accounting/posting";
import {
  buildBillLines,
  buildEquityLines,
  buildExpenseLines,
  buildIncomeLines,
  buildInvoiceLines,
  buildTransferLines,
} from "@/lib/accounting/transactions";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";

const K = SYSTEM_ACCOUNT_KEYS;
const ACCOUNTING_ROLES = ["ADMIN", "MANAGER", "ACCOUNTS"] as const;
type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
type NormalBalance = "DEBIT" | "CREDIT";
type TransactionResult =
  | { success: true; entryNumber: string }
  | { success: false; error: string };

function parseDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clean(value?: string): string | undefined {
  return value?.trim() || undefined;
}

function validateBase(
  amountInput: number,
  dateInput: string,
): { amount: number; date: Date } | { error: string } {
  const amount = Number(amountInput);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be positive" };
  }
  const date = parseDate(dateInput);
  if (!date) return { error: "Enter a valid transaction date" };
  return { amount, date };
}

function errorResult(error: unknown, fallback: string): TransactionResult {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

function revalidateAccounting() {
  for (const path of [
    "/accounting",
    "/accounting/transactions",
    "/accounting/ledger",
    "/accounting/trial-balance",
    "/accounting/profit-loss",
    "/accounting/balance-sheet",
    "/accounting/banking",
    "/accounting/debtors",
    "/accounting/creditors",
  ]) {
    revalidatePath(path);
  }
}

async function requireAccount(
  tx: any,
  accountId: string,
  options: {
    types: readonly AccountType[];
    isBank?: boolean;
    normalBalance?: NormalBalance;
    label: string;
  },
) {
  if (!accountId) throw new Error(`Pick ${options.label}`);
  const account = await tx.chartAccount.findFirst({
    where: { id: accountId, isActive: true },
    select: { id: true, type: true, isBank: true, normalBalance: true },
  });
  if (!account || !options.types.includes(account.type)) {
    throw new Error(`Pick a valid ${options.label} from your organization`);
  }
  if (options.isBank != null && account.isBank !== options.isBank) {
    throw new Error(`Pick a valid ${options.label} from your organization`);
  }
  if (
    options.normalBalance &&
    account.normalBalance !== options.normalBalance
  ) {
    throw new Error(`Pick a valid ${options.label} from your organization`);
  }
  return account;
}

async function resolveBankGl(
  tx: any,
  systemAccounts: Record<string, string>,
  bankAccountId?: string | null,
) {
  if (bankAccountId) {
    const bank = await tx.bankAccount.findFirst({
      where: { id: bankAccountId, isActive: true },
      select: {
        accountId: true,
        account: { select: { isActive: true, isBank: true, type: true } },
      },
    });
    if (
      !bank ||
      !bank.account.isActive ||
      !bank.account.isBank ||
      bank.account.type !== "ASSET"
    ) {
      throw new Error("Bank account not found in your organization");
    }
    return bank.accountId;
  }

  const cashId = systemAccounts[K.CASH];
  if (!cashId) {
    throw new Error("Cash on Hand is missing. Set up the chart of accounts.");
  }
  await requireAccount(tx, cashId, {
    types: ["ASSET"],
    isBank: true,
    label: "cash account",
  });
  return cashId;
}

async function ensureUniqueReference(
  tx: any,
  source: PostJournalInput["source"],
  sourceType: string,
  reference?: string,
) {
  if (
    reference &&
    (await alreadyPosted(tx, source, sourceType, reference))
  ) {
    throw new Error(`Reference ${reference} has already been posted`);
  }
}

export async function postExpense(input: {
  date: string;
  amount: number;
  expenseAccountId: string;
  bankAccountId?: string | null;
  hasVat?: boolean;
  memo?: string;
  reference?: string;
}): Promise<TransactionResult> {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const base = validateBase(input.amount, input.date);
  if ("error" in base) return { success: false, error: base.error };
  const reference = clean(input.reference);
  const memo = clean(input.memo);

  try {
    const entry = await withTenantTransaction(user.organizationId, async (tx) => {
      await requireAccount(tx, input.expenseAccountId, {
        types: ["EXPENSE"],
        normalBalance: "DEBIT",
        label: "expense account",
      });
      const systemAccounts = await getSystemAccounts(tx);
      const bankGlId = await resolveBankGl(tx, systemAccounts, input.bankAccountId);
      await ensureUniqueReference(tx, "MANUAL", "Expense", reference);
      return postJournalEntry(
        tx,
        user.organizationId,
        {
          date: base.date,
          memo: memo || (reference ? `Expense ${reference}` : "Expense"),
          source: "MANUAL",
          sourceType: "Expense",
          sourceId: reference,
          lines: buildExpenseLines({
            amount: base.amount,
            hasVat: Boolean(input.hasVat),
            expenseAccountId: input.expenseAccountId,
            bankAccountId: bankGlId,
            vatInputAccountId: systemAccounts[K.VAT_INPUT],
            memo,
          }),
        },
        user.id,
      );
    });
    revalidateAccounting();
    return { success: true, entryNumber: entry.entryNumber };
  } catch (error) {
    return errorResult(error, "Could not post expense");
  }
}

export async function postIncome(input: {
  date: string;
  amount: number;
  incomeAccountId: string;
  bankAccountId?: string | null;
  hasVat?: boolean;
  memo?: string;
  reference?: string;
}): Promise<TransactionResult> {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const base = validateBase(input.amount, input.date);
  if ("error" in base) return { success: false, error: base.error };
  const reference = clean(input.reference);
  const memo = clean(input.memo);

  try {
    const entry = await withTenantTransaction(user.organizationId, async (tx) => {
      await requireAccount(tx, input.incomeAccountId, {
        types: ["INCOME"],
        normalBalance: "CREDIT",
        label: "income account",
      });
      const systemAccounts = await getSystemAccounts(tx);
      const bankGlId = await resolveBankGl(tx, systemAccounts, input.bankAccountId);
      await ensureUniqueReference(tx, "MANUAL", "Income", reference);
      return postJournalEntry(
        tx,
        user.organizationId,
        {
          date: base.date,
          memo: memo || (reference ? `Income ${reference}` : "Other income"),
          source: "MANUAL",
          sourceType: "Income",
          sourceId: reference,
          lines: buildIncomeLines({
            amount: base.amount,
            hasVat: Boolean(input.hasVat),
            incomeAccountId: input.incomeAccountId,
            bankAccountId: bankGlId,
            vatOutputAccountId: systemAccounts[K.VAT_OUTPUT],
            memo,
          }),
        },
        user.id,
      );
    });
    revalidateAccounting();
    return { success: true, entryNumber: entry.entryNumber };
  } catch (error) {
    return errorResult(error, "Could not post income");
  }
}

export async function postBill(input: {
  date: string;
  amount: number;
  purchaseAccountId: string;
  supplierName?: string;
  hasVat?: boolean;
  memo?: string;
  reference?: string;
}): Promise<TransactionResult> {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const base = validateBase(input.amount, input.date);
  if ("error" in base) return { success: false, error: base.error };
  const reference = clean(input.reference);
  const memo = clean(input.memo);
  const supplierName = clean(input.supplierName);

  try {
    const entry = await withTenantTransaction(user.organizationId, async (tx) => {
      const purchaseAccount = await requireAccount(tx, input.purchaseAccountId, {
        types: ["EXPENSE", "ASSET"],
        isBank: false,
        normalBalance: "DEBIT",
        label: "expense or asset account",
      });
      const systemAccounts = await getSystemAccounts(tx);
      if (
        purchaseAccount.id === systemAccounts[K.ACCOUNTS_RECEIVABLE] ||
        purchaseAccount.id === systemAccounts[K.VAT_INPUT]
      ) {
        throw new Error("Pick an expense, inventory, or fixed asset account");
      }
      const payableId = systemAccounts[K.ACCOUNTS_PAYABLE];
      if (!payableId) {
        throw new Error("Accounts Payable is missing. Set up the chart of accounts.");
      }
      await ensureUniqueReference(tx, "PURCHASE", "ManualBill", reference);
      return postJournalEntry(
        tx,
        user.organizationId,
        {
          date: base.date,
          memo: memo || (reference ? `Bill ${reference}` : "Supplier bill"),
          source: "PURCHASE",
          sourceType: "ManualBill",
          sourceId: reference,
          lines: buildBillLines({
            amount: base.amount,
            hasVat: Boolean(input.hasVat),
            purchaseAccountId: input.purchaseAccountId,
            payableAccountId: payableId,
            vatInputAccountId: systemAccounts[K.VAT_INPUT],
            memo,
            supplierName,
          }),
        },
        user.id,
      );
    });
    revalidateAccounting();
    return { success: true, entryNumber: entry.entryNumber };
  } catch (error) {
    return errorResult(error, "Could not post bill");
  }
}

export async function postInvoice(input: {
  date: string;
  amount: number;
  customerName?: string;
  hasVat?: boolean;
  memo?: string;
  reference?: string;
}): Promise<TransactionResult> {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const base = validateBase(input.amount, input.date);
  if ("error" in base) return { success: false, error: base.error };
  const reference = clean(input.reference);
  const memo = clean(input.memo);
  const customerName = clean(input.customerName);

  try {
    const entry = await withTenantTransaction(user.organizationId, async (tx) => {
      const systemAccounts = await getSystemAccounts(tx);
      const receivableId = systemAccounts[K.ACCOUNTS_RECEIVABLE];
      const salesId = systemAccounts[K.SALES_REVENUE];
      if (!receivableId || !salesId) {
        throw new Error("Receivable or Sales account is missing. Set up the chart of accounts.");
      }
      await ensureUniqueReference(tx, "SALE", "ManualInvoice", reference);
      return postJournalEntry(
        tx,
        user.organizationId,
        {
          date: base.date,
          memo: memo || (reference ? `Invoice ${reference}` : "Sales invoice"),
          source: "SALE",
          sourceType: "ManualInvoice",
          sourceId: reference,
          lines: buildInvoiceLines({
            amount: base.amount,
            hasVat: Boolean(input.hasVat),
            receivableAccountId: receivableId,
            salesAccountId: salesId,
            vatOutputAccountId: systemAccounts[K.VAT_OUTPUT],
            memo,
            customerName,
          }),
        },
        user.id,
      );
    });
    revalidateAccounting();
    return { success: true, entryNumber: entry.entryNumber };
  } catch (error) {
    return errorResult(error, "Could not post invoice");
  }
}

export async function postTransfer(input: {
  date: string;
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  memo?: string;
  reference?: string;
}): Promise<TransactionResult> {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const base = validateBase(input.amount, input.date);
  if ("error" in base) return { success: false, error: base.error };
  if (input.fromAccountId === input.toAccountId) {
    return { success: false, error: "From and to accounts must differ" };
  }
  const reference = clean(input.reference);
  const memo = clean(input.memo);

  try {
    const entry = await withTenantTransaction(user.organizationId, async (tx) => {
      await Promise.all([
        requireAccount(tx, input.fromAccountId, {
          types: ["ASSET"],
          isBank: true,
          label: "source cash or bank account",
        }),
        requireAccount(tx, input.toAccountId, {
          types: ["ASSET"],
          isBank: true,
          label: "destination cash or bank account",
        }),
      ]);
      await ensureUniqueReference(tx, "MANUAL", "BankTransfer", reference);
      return postJournalEntry(
        tx,
        user.organizationId,
        {
          date: base.date,
          memo: memo || (reference ? `Transfer ${reference}` : "Bank transfer"),
          source: "MANUAL",
          sourceType: "BankTransfer",
          sourceId: reference,
          lines: buildTransferLines({
            amount: base.amount,
            fromAccountId: input.fromAccountId,
            toAccountId: input.toAccountId,
            memo,
          }),
        },
        user.id,
      );
    });
    revalidateAccounting();
    return { success: true, entryNumber: entry.entryNumber };
  } catch (error) {
    return errorResult(error, "Could not post transfer");
  }
}

export async function postEquityMovement(input: {
  kind: "CAPITAL" | "DRAWINGS";
  date: string;
  amount: number;
  equityAccountId: string;
  bankAccountId?: string | null;
  memo?: string;
  reference?: string;
}): Promise<TransactionResult> {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const base = validateBase(input.amount, input.date);
  if ("error" in base) return { success: false, error: base.error };
  if (input.kind !== "CAPITAL" && input.kind !== "DRAWINGS") {
    return { success: false, error: "Equity movement type is invalid" };
  }
  const reference = clean(input.reference);
  const memo = clean(input.memo);

  try {
    const entry = await withTenantTransaction(user.organizationId, async (tx) => {
      await requireAccount(tx, input.equityAccountId, {
        types: ["EQUITY"],
        normalBalance: input.kind === "CAPITAL" ? "CREDIT" : "DEBIT",
        label: input.kind === "CAPITAL" ? "capital account" : "drawings account",
      });
      const systemAccounts = await getSystemAccounts(tx);
      const bankGlId = await resolveBankGl(tx, systemAccounts, input.bankAccountId);
      await ensureUniqueReference(tx, "MANUAL", "EquityMovement", reference);
      return postJournalEntry(
        tx,
        user.organizationId,
        {
          date: base.date,
          memo:
            memo ||
            (input.kind === "CAPITAL"
              ? "Capital contribution"
              : "Owner drawings"),
          source: "MANUAL",
          sourceType: "EquityMovement",
          sourceId: reference,
          lines: buildEquityLines({
            kind: input.kind,
            amount: base.amount,
            equityAccountId: input.equityAccountId,
            bankAccountId: bankGlId,
            memo,
          }),
        },
        user.id,
      );
    });
    revalidateAccounting();
    return { success: true, entryNumber: entry.entryNumber };
  } catch (error) {
    return errorResult(error, "Could not post equity movement");
  }
}

export async function getTransactionFormData() {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const db = getTenantPrisma(user.organizationId);

  const [accounts, banks, systemAccounts] = await Promise.all([
    db.chartAccount.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalBalance: true,
        isBank: true,
      },
    }),
    db.bankAccount.findMany({
      where: { isActive: true, account: { isActive: true, isBank: true } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        accountId: true,
        account: { select: { code: true, name: true } },
      },
    }),
    getSystemAccounts(db),
  ]);

  const byType = (types: AccountType[], normalBalance: NormalBalance) =>
    accounts
      .filter(
        (account) =>
          types.includes(account.type) &&
          account.normalBalance === normalBalance,
      )
      .map((account) => ({
        id: account.id,
        code: account.code,
        name: account.name,
      }));
  const cashId = systemAccounts[K.CASH];

  return {
    seeded: accounts.length > 0,
    expense: byType(["EXPENSE"], "DEBIT"),
    income: byType(["INCOME"], "CREDIT"),
    purchase: accounts
      .filter(
        (account) =>
          (account.type === "EXPENSE" || account.type === "ASSET") &&
          account.normalBalance === "DEBIT" &&
          !account.isBank &&
          account.id !== systemAccounts[K.ACCOUNTS_RECEIVABLE] &&
          account.id !== systemAccounts[K.VAT_INPUT],
      )
      .map(({ id, code, name }) => ({ id, code, name })),
    capital: accounts
      .filter(
        (account) =>
          account.type === "EQUITY" && account.normalBalance === "CREDIT",
      )
      .map(({ id, code, name }) => ({ id, code, name })),
    drawings: accounts
      .filter(
        (account) =>
          account.type === "EQUITY" && account.normalBalance === "DEBIT",
      )
      .map(({ id, code, name }) => ({ id, code, name })),
    banks: banks
      .filter((bank) => bank.accountId !== cashId)
      .map(({ id, name }) => ({ id, name })),
    transferAccounts: banks.map((bank) => ({
      id: bank.accountId,
      code: bank.account.code,
      name: bank.account.name,
    })),
  };
}
