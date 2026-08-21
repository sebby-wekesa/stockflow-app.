"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  getSystemAccounts,
  postJournalEntry,
  SYSTEM_ACCOUNT_KEYS,
} from "@/lib/accounting/posting";
import {
  buildEmployeeCashBookLines,
  type EmployeeCashBookKind,
} from "@/lib/accounting/transactions";
import {
  primaryCurrencyBalance,
  summarizeCurrencyBalances,
} from "@/lib/accounting/workspace";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";
import type { PayrollWorkspaceData } from "@/actions/accounting-payroll";

const ACCOUNTING_ROLES = ["ADMIN", "MANAGER", "ACCOUNTS"] as const;
const CASH_HAND_TERMS = [
  "cash",
  "petty",
  "m-pesa",
  "mpesa",
  "till",
  "drawer",
  "wallet",
  "paybill",
];

export type CashBookGroupKey = "BANK" | "CASH";
export type SourceType = "Customer" | "Supplier" | "Employee" | "Other";
export type CashBookTransactionMode = "deposit" | "cheque";
export type EmployeePostingKind = EmployeeCashBookKind;

export type CurrencyBalance = {
  currency: string;
  amount: number;
};

export type CashBookAccountRow = {
  id: string;
  bankAccountId: string;
  accountId: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  glCode: string;
  currency: string;
  branchId: string | null;
  branchName: string | null;
  balance: number;
  isSystem: boolean;
  isActive: boolean;
  status: "Active" | "Inactive";
  reconciliationStatus: "Unreconciled" | "Ready";
  group: CashBookGroupKey;
};

export type CashBookGroup = {
  key: CashBookGroupKey;
  title: string;
  balance: number;
  balances: CurrencyBalance[];
  accounts: CashBookAccountRow[];
};

export type AccountOption = {
  id: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  isBank: boolean;
};

export type AccountBalanceRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  currency: string;
  balance: number;
};

export type PartyOption = {
  id: string;
  name: string;
  type: SourceType;
};

export type BranchOption = {
  id: string;
  code: string;
  name: string;
};

export type RecentAccountingTransaction = {
  id: string;
  date: string;
  reference: string;
  entryNumber: string;
  account: string;
  accountId: string | null;
  bankAccountId: string | null;
  source: string;
  sourceType: SourceType | "Ledger";
  type: string;
  amount: number;
  status: string;
  branch: string | null;
  description: string | null;
  category: string;
};

export type LedgerDetailLine = {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type AgeingRow = {
  id: string;
  name: string;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  total: number;
  lastTransactionDate: string | null;
  status: "Current" | "Open";
  ledger: LedgerDetailLine[];
};

export type EmployeeLedgerRow = {
  id: string;
  name: string;
  advances: number;
  reimbursements: number;
  payrollDeductions: number;
  amountReceivable: number;
  amountPayable: number;
  netCurrentBalance: number;
  lastTransactionDate: string | null;
  status: "Current" | "Open";
};

export type AccountingWorkspaceData = {
  seeded: boolean;
  cashBook: {
    bank: CashBookGroup;
    cash: CashBookGroup;
  };
  accountBalances: AccountBalanceRow[];
  recentTransactions: RecentAccountingTransaction[];
  debtors: {
    rows: AgeingRow[];
    total: number;
  };
  creditors: {
    rows: AgeingRow[];
    total: number;
  };
  employees: {
    rows: EmployeeLedgerRow[];
    total: number;
  };
  payroll: PayrollWorkspaceData;
  options: {
    branches: BranchOption[];
    accounts: AccountOption[];
    incomeAccounts: AccountOption[];
    expenseAccounts: AccountOption[];
    cashBookAccounts: CashBookAccountRow[];
    parties: PartyOption[];
  };
  trialBalance: {
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
  };
};

type LedgerAmountLine = {
  accountId: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
};

type AgeingBucket = "current" | "days1To30" | "days31To60" | "days61To90" | "over90";

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clean(value?: string | null) {
  return value?.trim() || "";
}

function parseDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cashBookGroupFor(input: {
  accountName: string;
  bankName?: string | null;
  note?: string | null;
}) {
  const searchable = [
    input.accountName,
    input.bankName ?? "",
    input.note ?? "",
  ].join(" ").toLowerCase();
  return CASH_HAND_TERMS.some((term) => searchable.includes(term))
    ? "CASH"
    : "BANK";
}

function revalidateAccountingWorkspace() {
  for (const path of [
    "/accounting",
    "/accounting/banking",
    "/accounting/chart",
    "/accounting/ledger",
    "/accounting/trial-balance",
    "/accounting/debtors",
    "/accounting/creditors",
  ]) {
    revalidatePath(path);
  }
}

function sourceTypeFromJournal(source?: string | null, sourceType?: string | null) {
  if (sourceType?.startsWith("deposit:")) return "Receive Deposit";
  if (sourceType?.startsWith("cheque:")) return "Write Cheque";
  if (source === "PAYMENT_RECEIVED") return "Receive Deposit";
  if (source === "PAYMENT_MADE") return "Write Cheque";
  if (sourceType === "BankTransfer") return "Transfer";
  if (sourceType === "ManualInvoice") return "Invoice";
  if (sourceType === "ManualCreditNote") return "Credit Note";
  if (sourceType === "ManualBill") return "Bill";
  if (sourceType === "ManualDebitNote") return "Debit Note";
  if (sourceType === "Expense") return "Expense";
  if (sourceType === "Income") return "Revenue";
  if (sourceType === "CashBookAccount") return "Opening Balance";
  if (sourceType === "EquityMovement") return "Equity";
  return sourceType ?? source ?? "Journal Entry";
}

function categoryForTransaction(input: {
  source?: string | null;
  sourceType?: string | null;
  memo?: string | null;
  accountNames: string[];
}) {
  const text = [
    input.source ?? "",
    input.sourceType ?? "",
    input.memo ?? "",
    ...input.accountNames,
  ].join(" ").toLowerCase();

  if (text.includes("payroll") || text.includes("salary") || text.includes("wage")) {
    return "Payroll";
  }
  if (text.includes("finance") || text.includes("bank charge") || text.includes("interest")) {
    return "Finance Charges";
  }
  if (text.includes("office") || text.includes("administrative") || text.includes("professional")) {
    return "Administrative Expenses";
  }
  if (
    text.includes("expense") ||
    text.includes("rent") ||
    text.includes("fuel") ||
    text.includes("maintenance") ||
    text.includes("electricity")
  ) {
    return "Operating Expenses";
  }
  return "General";
}

function ageingBucket(date: Date, asOf: Date): AgeingBucket {
  const ageDays = Math.max(
    0,
    Math.floor((asOf.getTime() - date.getTime()) / 86_400_000),
  );
  if (ageDays <= 0) return "current";
  if (ageDays <= 30) return "days1To30";
  if (ageDays <= 60) return "days31To60";
  if (ageDays <= 90) return "days61To90";
  return "over90";
}

function emptyAgeingRow(id: string, name: string): AgeingRow {
  return {
    id,
    name,
    current: 0,
    days1To30: 0,
    days31To60: 0,
    days61To90: 0,
    over90: 0,
    total: 0,
    lastTransactionDate: null,
    status: "Current",
    ledger: [],
  };
}

function reduceOldestBuckets(row: AgeingRow, paymentTotal: number) {
  let remaining = paymentTotal;
  for (const key of ["over90", "days61To90", "days31To60", "days1To30", "current"] as const) {
    if (remaining <= 0) break;
    const reduction = Math.min(row[key], remaining);
    row[key] = round2(row[key] - reduction);
    remaining = round2(remaining - reduction);
  }
  row.total = round2(
    row.current +
      row.days1To30 +
      row.days31To60 +
      row.days61To90 +
      row.over90,
  );
}

async function writeAccountingAudit(
  tx: any,
  user: { id: string; organizationId: string },
  input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    transactionReference?: string | null;
    originalValues?: unknown;
    newValues?: unknown;
  },
) {
  await tx.auditLog.create({
    data: {
      userId: user.id,
      organizationId: user.organizationId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: JSON.stringify({
        transactionReference: input.transactionReference ?? null,
        originalValues: input.originalValues ?? null,
        newValues: input.newValues ?? null,
      }),
    },
  });
}

async function nextPaymentNumber(
  tx: any,
  direction: "RECEIVED" | "PAID",
): Promise<string> {
  const prefix = direction === "RECEIVED" ? "RCT" : "PMT";
  const year = new Date().getFullYear();
  const last = await tx.payment.findFirst({
    where: { direction, paymentNumber: { startsWith: `${prefix}-${year}-` } },
    orderBy: { createdAt: "desc" },
    select: { paymentNumber: true },
  });
  const match = last?.paymentNumber.match(new RegExp(`${prefix}-\\d{4}-(\\d+)`));
  const next = match ? Number.parseInt(match[1], 10) + 1 : 1;
  return `${prefix}-${year}-${next.toString().padStart(6, "0")}`;
}

async function nextCashBookCode(
  tx: {
    chartAccount: {
      findMany: (args: {
        where: { type: "ASSET"; code: { startsWith: string } };
        select: { code: true };
      }) => Promise<{ code: string }[]>;
    };
  },
  group: CashBookGroupKey,
) {
  const prefix = group === "BANK" ? "11" : "10";
  const base = group === "BANK" ? 1100 : 1000;
  const accounts = await tx.chartAccount.findMany({
    where: { type: "ASSET", code: { startsWith: prefix } },
    select: { code: true },
  });
  const used = new Set(accounts.map((account) => account.code));
  const maxCode = accounts.reduce((max, account) => {
    const parsed = Number.parseInt(account.code, 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, base - 10);

  let next = Math.max(base, maxCode + 10);
  while (used.has(String(next))) next += 10;
  return String(next);
}

async function buildAgeingData(db: ReturnType<typeof getTenantPrisma>) {
  const asOf = new Date();
  const [customers, customerPayments, suppliers, supplierPayments] =
    await Promise.all([
      db.customer.findMany({
        orderBy: { name: "asc" },
        include: {
          SaleOrder: {
            where: {
              status: { in: ["CONFIRMED", "READY_FOR_DISPATCH", "SHIPPED"] },
            },
            select: { id: true, totalAmount: true, createdAt: true },
          },
        },
      }),
      db.payment.findMany({
        where: { customerId: { not: null } },
        select: {
          customerId: true,
          direction: true,
          amount: true,
          date: true,
          paymentNumber: true,
          reference: true,
        },
      }),
      db.supplier.findMany({
        orderBy: { name: "asc" },
        include: {
          PurchaseOrder: {
            where: { status: { in: ["APPROVED", "ORDERED", "RECEIVED"] } },
            select: { id: true, poNumber: true, totalAmount: true, createdAt: true },
          },
        },
      }),
      db.payment.findMany({
        where: { supplierId: { not: null } },
        select: {
          supplierId: true,
          direction: true,
          amount: true,
          date: true,
          paymentNumber: true,
          reference: true,
        },
      }),
    ]);

  const customerPaid = new Map<string, number>();
  for (const payment of customerPayments) {
    if (!payment.customerId || payment.direction !== "RECEIVED") continue;
    customerPaid.set(
      payment.customerId,
      round2((customerPaid.get(payment.customerId) ?? 0) + Number(payment.amount)),
    );
  }

  const supplierPaid = new Map<string, number>();
  for (const payment of supplierPayments) {
    if (!payment.supplierId || payment.direction !== "PAID") continue;
    supplierPaid.set(
      payment.supplierId,
      round2((supplierPaid.get(payment.supplierId) ?? 0) + Number(payment.amount)),
    );
  }

  const debtors = customers.flatMap((customer) => {
    const row = emptyAgeingRow(customer.id, customer.name);
    for (const sale of customer.SaleOrder) {
      const bucket = ageingBucket(sale.createdAt, asOf);
      row[bucket] = round2(row[bucket] + Number(sale.totalAmount));
      row.ledger.push({
        date: sale.createdAt.toISOString().slice(0, 10),
        reference: `SALE-${sale.id.slice(0, 8)}`,
        description: "Sales invoice",
        debit: round2(Number(sale.totalAmount)),
        credit: 0,
        runningBalance: 0,
      });
    }
    for (const payment of customerPayments) {
      if (payment.customerId !== customer.id) continue;
      const isReceipt = payment.direction === "RECEIVED";
      row.ledger.push({
        date: payment.date.toISOString().slice(0, 10),
        reference: payment.reference || payment.paymentNumber,
        description: isReceipt ? "Customer receipt" : "Customer refund",
        debit: isReceipt ? 0 : round2(Number(payment.amount)),
        credit: isReceipt ? round2(Number(payment.amount)) : 0,
        runningBalance: 0,
      });
    }
    reduceOldestBuckets(row, customerPaid.get(customer.id) ?? 0);
    let running = 0;
    row.ledger = row.ledger
      .sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference))
      .map((line) => {
        running = round2(running + line.debit - line.credit);
        return { ...line, runningBalance: running };
      });
    row.lastTransactionDate = row.ledger.at(-1)?.date ?? null;
    row.status = row.total >= 0.01 ? "Open" : "Current";
    return row.total === 0 ? [] : [row];
  });

  const creditors = suppliers.flatMap((supplier) => {
    const row = emptyAgeingRow(supplier.id, supplier.name);
    for (const purchase of supplier.PurchaseOrder) {
      const bucket = ageingBucket(purchase.createdAt, asOf);
      row[bucket] = round2(row[bucket] + Number(purchase.totalAmount));
      row.ledger.push({
        date: purchase.createdAt.toISOString().slice(0, 10),
        reference: purchase.poNumber || `PO-${purchase.id.slice(0, 8)}`,
        description: "Supplier bill",
        debit: 0,
        credit: round2(Number(purchase.totalAmount)),
        runningBalance: 0,
      });
    }
    for (const payment of supplierPayments) {
      if (payment.supplierId !== supplier.id) continue;
      const isPayment = payment.direction === "PAID";
      row.ledger.push({
        date: payment.date.toISOString().slice(0, 10),
        reference: payment.reference || payment.paymentNumber,
        description: isPayment ? "Supplier payment" : "Supplier refund",
        debit: isPayment ? round2(Number(payment.amount)) : 0,
        credit: isPayment ? 0 : round2(Number(payment.amount)),
        runningBalance: 0,
      });
    }
    reduceOldestBuckets(row, supplierPaid.get(supplier.id) ?? 0);
    let running = 0;
    row.ledger = row.ledger
      .sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference))
      .map((line) => {
        running = round2(running + line.credit - line.debit);
        return { ...line, runningBalance: running };
      });
    row.lastTransactionDate = row.ledger.at(-1)?.date ?? null;
    row.status = row.total >= 0.01 ? "Open" : "Current";
    return row.total === 0 ? [] : [row];
  });

  return {
    debtors: {
      rows: debtors,
      total: round2(debtors.reduce((sum, row) => sum + row.total, 0)),
    },
    creditors: {
      rows: creditors,
      total: round2(creditors.reduce((sum, row) => sum + row.total, 0)),
    },
  };
}

async function buildEmployeeLedgerData(
  db: ReturnType<typeof getTenantPrisma>,
  employees: { id: string; name: string | null; email: string }[],
  systemAccounts: Record<string, string>,
) {
  const receivableId = systemAccounts[SYSTEM_ACCOUNT_KEYS.EMPLOYEE_RECEIVABLES];
  const payableId = systemAccounts[SYSTEM_ACCOUNT_KEYS.EMPLOYEE_PAYABLES];
  if (!receivableId && !payableId) {
    return { rows: [], total: 0 };
  }

  const employeeById = new Map(
    employees.map((employee) => [
      employee.id,
      employee.name || employee.email,
    ]),
  );
  const rows = new Map<string, EmployeeLedgerRow>();
  const journals = await db.journalEntry.findMany({
    where: {
      status: "POSTED",
      sourceType: { contains: "Employee" },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      date: true,
      sourceType: true,
      sourceId: true,
      lines: {
        select: {
          accountId: true,
          debit: true,
          credit: true,
        },
      },
    },
  });

  for (const journal of journals) {
    const employeeId = journal.sourceId?.split(":")[0];
    if (!employeeId || !employeeById.has(employeeId)) continue;
    const row =
      rows.get(employeeId) ??
      {
        id: employeeId,
        name: employeeById.get(employeeId)!,
        advances: 0,
        reimbursements: 0,
        payrollDeductions: 0,
        amountReceivable: 0,
        amountPayable: 0,
        netCurrentBalance: 0,
        lastTransactionDate: null,
        status: "Current" as const,
      };

    for (const line of journal.lines) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      if (line.accountId === receivableId) {
        row.amountReceivable = round2(row.amountReceivable + debit - credit);
        if (journal.sourceType?.includes("ADVANCE_PAID")) {
          row.advances = round2(row.advances + debit);
        }
        if (journal.sourceType?.includes("ADVANCE_REPAID")) {
          row.payrollDeductions = round2(row.payrollDeductions + credit);
        }
      }
      if (line.accountId === payableId) {
        row.amountPayable = round2(row.amountPayable + credit - debit);
        if (journal.sourceType?.includes("REIMBURSEMENT_PAID")) {
          row.reimbursements = round2(row.reimbursements + debit);
        }
      }
    }

    row.netCurrentBalance = round2(row.amountReceivable - row.amountPayable);
    row.status = Math.abs(row.netCurrentBalance) >= 0.01 ? "Open" : "Current";
    row.lastTransactionDate = journal.date.toISOString().slice(0, 10);
    rows.set(employeeId, row);
  }

  const visibleRows = [...rows.values()].filter(
    (row) =>
      row.advances !== 0 ||
      row.reimbursements !== 0 ||
      row.payrollDeductions !== 0 ||
      row.amountReceivable !== 0 ||
      row.amountPayable !== 0,
  );

  return {
    rows: visibleRows,
    total: round2(
      visibleRows.reduce((sum, row) => sum + row.netCurrentBalance, 0),
    ),
  };
}

export async function getAccountingWorkspaceData(): Promise<AccountingWorkspaceData> {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const db = getTenantPrisma(user.organizationId);

  const [
    bankAccounts,
    ledgerLines,
    accounts,
    branches,
    customers,
    suppliers,
    employees,
    journals,
    ageing,
    systemAccounts,
  ] = await Promise.all([
    db.bankAccount.findMany({
      where: { account: { isBank: true } },
      orderBy: { name: "asc" },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            currency: true,
            branchId: true,
            isSystem: true,
            isActive: true,
            note: true,
            Branch: { select: { name: true } },
          },
        },
      },
    }),
    db.ledgerLine.findMany({
      where: { journalEntry: { status: "POSTED" } },
      select: { accountId: true, debit: true, credit: true },
    }) as Promise<LedgerAmountLine[]>,
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
        currency: true,
      },
    }),
    db.branch.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER", "ACCOUNTS", "OPERATOR", "SALES", "PACKAGING", "WAREHOUSE"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    db.journalEntry.findMany({
      where: { status: "POSTED" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 80,
      include: {
        Branch: { select: { name: true } },
        payments: {
          select: {
            paymentNumber: true,
            direction: true,
            amount: true,
            reference: true,
            Customer: { select: { name: true } },
            Supplier: { select: { name: true } },
          },
        },
        lines: {
          select: {
            accountId: true,
            debit: true,
            credit: true,
            description: true,
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                isBank: true,
                bankAccount: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    buildAgeingData(db),
    getSystemAccounts(db),
  ]);

  const sumsByAccount = new Map<string, { debit: number; credit: number }>();
  for (const line of ledgerLines) {
    const current = sumsByAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
    current.debit += Number(line.debit);
    current.credit += Number(line.credit);
    sumsByAccount.set(line.accountId, current);
  }

  const cashBookAccounts: CashBookAccountRow[] = bankAccounts.map((bank) => {
    const totals = sumsByAccount.get(bank.accountId) ?? { debit: 0, credit: 0 };
    const balance = round2(
      Number(bank.openingBalance ?? 0) + totals.debit - totals.credit,
    );
    const group = cashBookGroupFor({
      accountName: `${bank.name} ${bank.account.name}`,
      bankName: bank.bankName,
      note: bank.account.note,
    });
    return {
      id: bank.id,
      bankAccountId: bank.id,
      accountId: bank.accountId,
      name: bank.name || bank.account.name,
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      glCode: bank.account.code,
      currency: bank.currency,
      branchId: bank.account.branchId,
      branchName: bank.account.Branch?.name ?? null,
      balance,
      isSystem: bank.account.isSystem,
      isActive: bank.isActive && bank.account.isActive,
      status: bank.isActive && bank.account.isActive ? "Active" : "Inactive",
      reconciliationStatus: "Unreconciled",
      group,
    };
  });

  const openingBalancesByAccount = new Map(
    bankAccounts.map((bank) => [bank.accountId, Number(bank.openingBalance ?? 0)]),
  );
  const accountBalances: AccountBalanceRow[] = accounts.map((account) => {
    const totals = sumsByAccount.get(account.id) ?? { debit: 0, credit: 0 };
    const ledgerBalance =
      account.normalBalance === "CREDIT"
        ? totals.credit - totals.debit
        : totals.debit - totals.credit;

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      currency: account.currency,
      balance: round2(ledgerBalance + (openingBalancesByAccount.get(account.id) ?? 0)),
    };
  });

  const bankRows = cashBookAccounts.filter((account) => account.group === "BANK");
  const cashRows = cashBookAccounts.filter((account) => account.group === "CASH");
  const bankBalances = summarizeCurrencyBalances(bankRows);
  const cashBalances = summarizeCurrencyBalances(cashRows);
  const employeeLedger = await buildEmployeeLedgerData(
    db,
    employees,
    systemAccounts,
  );
  const payrollRuns = await db.payrollRun.findMany({
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    take: 12,
    include: {
      journalEntry: { select: { entryNumber: true } },
      _count: { select: { entries: true } },
    },
  });

  let trialDebit = 0;
  let trialCredit = 0;
  for (const account of accounts) {
    const totals = sumsByAccount.get(account.id) ?? { debit: 0, credit: 0 };
    const net = totals.debit - totals.credit;
    if (account.normalBalance === "DEBIT") {
      trialDebit += net > 0 ? net : 0;
      trialCredit += net < 0 ? -net : 0;
    } else {
      trialDebit += net > 0 ? net : 0;
      trialCredit += net < 0 ? -net : 0;
    }
  }
  trialDebit = round2(trialDebit);
  trialCredit = round2(trialCredit);

  const employeeNameById = new Map(
    employees.map((employee) => [employee.id, employee.name || employee.email]),
  );

  const recentTransactions: RecentAccountingTransaction[] = journals.map((entry) => {
    const payment = entry.payments[0] ?? null;
    const cashLine =
      entry.lines.find((line) => line.account.isBank) ?? entry.lines[0] ?? null;
    const amount = round2(
      entry.lines.reduce((max, line) => {
        const lineAmount = Math.max(Number(line.debit), Number(line.credit));
        return Math.max(max, lineAmount);
      }, 0),
    );
    const accountNames = entry.lines.map((line) => line.account.name);
    const employeeId = entry.sourceType?.includes("Employee")
      ? entry.sourceId?.split(":")[0]
      : null;
    const derivedSourceType: RecentAccountingTransaction["sourceType"] =
      payment?.Customer
        ? "Customer"
        : payment?.Supplier
          ? "Supplier"
          : entry.sourceType?.includes("Employee")
            ? "Employee"
            : entry.sourceType?.includes("Other")
              ? "Other"
              : "Ledger";
    const source =
      payment?.Customer?.name ??
      payment?.Supplier?.name ??
      (employeeId ? employeeNameById.get(employeeId) : null) ??
      (entry.sourceType?.includes("Other")
        ? cashLine?.description?.split(" - ")[0]
        : null) ??
      entry.sourceId ??
      entry.memo ??
      "Manual journal";

    return {
      id: entry.id,
      date: entry.date.toISOString().slice(0, 10),
      reference: payment?.paymentNumber ?? entry.sourceId ?? entry.entryNumber,
      entryNumber: entry.entryNumber,
      account: cashLine
        ? `${cashLine.account.code} - ${cashLine.account.bankAccount?.name ?? cashLine.account.name}`
        : "Multiple accounts",
      accountId: cashLine?.accountId ?? null,
      bankAccountId: cashLine?.account.bankAccount?.id ?? null,
      source,
      sourceType: derivedSourceType,
      type: sourceTypeFromJournal(entry.source, entry.sourceType),
      amount,
      status: entry.status,
      branch: entry.Branch?.name ?? null,
      description: cashLine?.description ?? entry.memo,
      category: categoryForTransaction({
        source: entry.source,
        sourceType: entry.sourceType,
        memo: entry.memo,
        accountNames,
      }),
    };
  });

  return {
    seeded: accounts.length > 0,
    cashBook: {
      bank: {
        key: "BANK",
        title: "Cash at Bank",
        balance: primaryCurrencyBalance(bankBalances),
        balances: bankBalances,
        accounts: bankRows,
      },
      cash: {
        key: "CASH",
        title: "Cash in Hand",
        balance: primaryCurrencyBalance(cashBalances),
        balances: cashBalances,
        accounts: cashRows,
      },
    },
    accountBalances,
    recentTransactions,
    debtors: ageing.debtors,
    creditors: ageing.creditors,
    employees: employeeLedger,
    payroll: {
      employees: employees.map((employee) => ({
        id: employee.id,
        name: employee.name || employee.email,
        email: employee.email,
      })),
      runs: payrollRuns.map((run) => ({
        id: run.id,
        period: run.period,
        payDate: run.payDate.toISOString().slice(0, 10),
        status: run.status,
        entryNumber: run.journalEntry?.entryNumber ?? null,
        employeeCount: run._count.entries,
        totalGrossPay: Number(run.totalGrossPay),
        totalDeductions: Number(run.totalDeductions),
        totalNetPay: Number(run.totalNetPay),
      })),
    },
    options: {
      branches,
      accounts,
      incomeAccounts: accounts.filter(
        (account) => account.type === "INCOME" && account.normalBalance === "CREDIT",
      ),
      expenseAccounts: accounts.filter(
        (account) => account.type === "EXPENSE" && account.normalBalance === "DEBIT",
      ),
      cashBookAccounts,
      parties: [
        ...customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          type: "Customer" as const,
        })),
        ...suppliers.map((supplier) => ({
          id: supplier.id,
          name: supplier.name,
          type: "Supplier" as const,
        })),
        ...employees.map((employee) => ({
          id: employee.id,
          name: employee.name || employee.email,
          type: "Employee" as const,
        })),
      ],
    },
    trialBalance: {
      totalDebit: trialDebit,
      totalCredit: trialCredit,
      balanced: Math.abs(trialDebit - trialCredit) < 0.01,
    },
  };
}

export async function createCashBookAccount(input: {
  group: CashBookGroupKey;
  bankName?: string;
  accountName: string;
  accountNumber?: string;
  branchId?: string | null;
  currency?: string;
  openingBalance?: number;
  openingBalanceDate?: string;
  cashType?: string;
  description?: string;
  isActive?: boolean;
}) {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const accountName = clean(input.accountName);
  const bankName = clean(input.bankName);
  const cashType = clean(input.cashType);
  const accountNumber = clean(input.accountNumber);
  const currency = clean(input.currency || "KES").toUpperCase();
  const openingBalance = Number(input.openingBalance ?? 0);
  const openingBalanceDate = input.openingBalanceDate
    ? parseDate(input.openingBalanceDate)
    : new Date();

  if (input.group !== "BANK" && input.group !== "CASH") {
    return { success: false, error: "Cash-book group is invalid" };
  }
  if (!accountName) {
    return { success: false, error: "Account name is required" };
  }
  if (input.group === "BANK" && !bankName) {
    return { success: false, error: "Bank name is required" };
  }
  if (input.group === "CASH" && !cashType) {
    return { success: false, error: "Cash account type is required" };
  }
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    return { success: false, error: "Opening balance must be zero or more" };
  }
  if (!openingBalanceDate) {
    return { success: false, error: "Opening balance date is invalid" };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { success: false, error: "Currency must be a three-letter code" };
  }

  try {
    const result = await withTenantTransaction(user.organizationId, async (tx) => {
      const branchId = clean(input.branchId);
      if (branchId) {
        const allowedBranchIds = new Set(user.branches.map((branch) => branch.id));
        if (
          user.role !== "ADMIN" &&
          user.role !== "MANAGER" &&
          allowedBranchIds.size > 0 &&
          !allowedBranchIds.has(branchId)
        ) {
          throw new Error("You do not have access to that branch");
        }
        const branch = await tx.branch.findFirst({
          where: { id: branchId },
          select: { id: true },
        });
        if (!branch) throw new Error("Pick a valid branch");
      }

      if (accountNumber) {
        const duplicate = await tx.bankAccount.findFirst({
          where: { accountNumber, isActive: true },
          select: { id: true },
        });
        if (duplicate) {
          throw new Error("An active account with that account number already exists");
        }
      }

      const code = await nextCashBookCode(tx, input.group);
      const chartAccount = await tx.chartAccount.create({
        data: {
          organizationId: user.organizationId,
          code,
          name: accountName,
          type: "ASSET",
          normalBalance: "DEBIT",
          classification: "BANK",
          statementGroup: "CURRENT_ASSETS",
          currency,
          branchId: branchId || null,
          isBank: true,
          isActive: input.isActive ?? true,
          description: clean(input.description) || null,
          note:
            input.group === "CASH"
              ? `cash_book_group:CASH;cash_type:${cashType}`
              : "cash_book_group:BANK",
        },
        select: { id: true },
      });

      const bankAccount = await tx.bankAccount.create({
        data: {
          organizationId: user.organizationId,
          accountId: chartAccount.id,
          name: accountName,
          bankName: input.group === "BANK" ? bankName : cashType,
          accountNumber: accountNumber || null,
          currency,
          openingBalance: 0,
          isActive: input.isActive ?? true,
        },
        select: { id: true },
      });

      if (openingBalance > 0) {
        const systemAccounts = await getSystemAccounts(tx);
        const equityAccountId =
          systemAccounts[SYSTEM_ACCOUNT_KEYS.RETAINED_EARNINGS] ??
          (
            await tx.chartAccount.findFirst({
              where: {
                type: "EQUITY",
                normalBalance: "CREDIT",
                isActive: true,
              },
              orderBy: { code: "asc" },
              select: { id: true },
            })
          )?.id;
        if (!equityAccountId) {
          throw new Error("Create an equity account before entering an opening balance");
        }

        await postJournalEntry(
          tx,
          user.organizationId,
          {
            date: openingBalanceDate,
            memo: `Opening balance - ${accountName}`,
            source: "OPENING_BALANCE",
            sourceType: "CashBookAccount",
            sourceId: bankAccount.id,
            branchId: branchId || null,
            lines: [
              {
                accountId: chartAccount.id,
                debit: round2(openingBalance),
                description: "Opening balance",
              },
              {
                accountId: equityAccountId,
                credit: round2(openingBalance),
                description: "Opening balance offset",
              },
            ],
          },
          user.id,
        );
      }

      await writeAccountingAudit(tx, user, {
        action: "ACCOUNTING_CASH_BOOK_ACCOUNT_CREATED",
        entityType: "BankAccount",
        entityId: bankAccount.id,
        transactionReference: bankAccount.id,
        newValues: {
          group: input.group,
          accountName,
          bankName: input.group === "BANK" ? bankName : cashType,
          accountNumber: accountNumber || null,
          currency,
          openingBalance,
          openingBalanceDate: openingBalanceDate.toISOString().slice(0, 10),
          branchId: branchId || null,
          isActive: input.isActive ?? true,
        },
      });

      return { bankAccountId: bankAccount.id };
    });

    revalidateAccountingWorkspace();
    return { success: true, ...result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not create cash-book account",
    };
  }
}

export async function updateCashBookAccount(input: {
  bankAccountId: string;
  accountName: string;
  bankName?: string | null;
  accountNumber?: string | null;
  branchId?: string | null;
  currency?: string;
}) {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const accountName = clean(input.accountName);
  const currency = clean(input.currency || "KES").toUpperCase();

  if (!input.bankAccountId) {
    return { success: false, error: "Account is required" };
  }
  if (!accountName) {
    return { success: false, error: "Account name is required" };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { success: false, error: "Currency must be a three-letter code" };
  }

  try {
    await withTenantTransaction(user.organizationId, async (tx) => {
      const bank = await tx.bankAccount.findFirst({
        where: { id: input.bankAccountId },
        select: {
          id: true,
          accountId: true,
          name: true,
          bankName: true,
          accountNumber: true,
          currency: true,
          account: { select: { branchId: true, name: true } },
        },
      });
      if (!bank) throw new Error("Account not found");

      const branchId = clean(input.branchId);
      if (branchId) {
        const allowedBranchIds = new Set(user.branches.map((branch) => branch.id));
        if (
          user.role !== "ADMIN" &&
          user.role !== "MANAGER" &&
          allowedBranchIds.size > 0 &&
          !allowedBranchIds.has(branchId)
        ) {
          throw new Error("You do not have access to that branch");
        }
        const branch = await tx.branch.findFirst({
          where: { id: branchId },
          select: { id: true },
        });
        if (!branch) throw new Error("Pick a valid branch");
      }

      const accountNumber = clean(input.accountNumber);
      if (accountNumber) {
        const duplicate = await tx.bankAccount.findFirst({
          where: {
            accountNumber,
            isActive: true,
            id: { not: bank.id },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new Error("An active account with that account number already exists");
        }
      }

      await tx.chartAccount.update({
        where: { id: bank.accountId },
        data: {
          name: accountName,
          currency,
          branchId: branchId || null,
        },
      });
      await tx.bankAccount.update({
        where: { id: bank.id },
        data: {
          name: accountName,
          bankName: clean(input.bankName) || null,
          accountNumber: accountNumber || null,
          currency,
        },
      });
      await writeAccountingAudit(tx, user, {
        action: "ACCOUNTING_CASH_BOOK_ACCOUNT_UPDATED",
        entityType: "BankAccount",
        entityId: bank.id,
        originalValues: {
          accountName: bank.name,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          currency: bank.currency,
          branchId: bank.account.branchId,
        },
        newValues: {
          accountName,
          bankName: clean(input.bankName) || null,
          accountNumber: accountNumber || null,
          currency,
          branchId: branchId || null,
        },
      });
    });

    revalidateAccountingWorkspace();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not update cash-book account",
    };
  }
}

export async function deactivateCashBookAccount(bankAccountId: string) {
  const user = await requireRole(...ACCOUNTING_ROLES);
  if (!bankAccountId) return { success: false, error: "Account is required" };

  try {
    await withTenantTransaction(user.organizationId, async (tx) => {
      const bank = await tx.bankAccount.findFirst({
        where: { id: bankAccountId, isActive: true },
        include: {
          account: {
            select: { id: true, isSystem: true },
          },
        },
      });
      if (!bank) throw new Error("Account not found");
      if (bank.account.isSystem) {
        throw new Error("System accounts cannot be deactivated");
      }

      const totals = await tx.ledgerLine.aggregate({
        where: {
          accountId: bank.accountId,
          journalEntry: { status: "POSTED" },
        },
        _sum: { debit: true, credit: true },
      });
      const balance = round2(
        Number(bank.openingBalance ?? 0) +
          Number(totals._sum.debit ?? 0) -
          Number(totals._sum.credit ?? 0),
      );
      if (Math.abs(balance) >= 0.01) {
        throw new Error("Transfer or clear the account balance before deactivation");
      }

      await tx.bankAccount.update({
        where: { id: bank.id },
        data: { isActive: false },
      });
      await tx.chartAccount.update({
        where: { id: bank.accountId },
        data: { isActive: false },
      });
      await writeAccountingAudit(tx, user, {
        action: "ACCOUNTING_CASH_BOOK_ACCOUNT_DEACTIVATED",
        entityType: "BankAccount",
        entityId: bank.id,
        originalValues: {
          isActive: true,
          accountId: bank.accountId,
        },
        newValues: { isActive: false },
      });
    });

    revalidateAccountingWorkspace();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not deactivate account",
    };
  }
}

export async function postCashBookTransaction(input: {
  mode: CashBookTransactionMode;
  bankAccountId: string;
  date: string;
  amount: number;
  branchId?: string | null;
  reference?: string;
  memo?: string;
  sourceName: string;
  sourceType: SourceType;
  sourceId?: string | null;
  incomeAccountId?: string | null;
  expenseAccountId?: string | null;
  employeePostingKind?: EmployeePostingKind;
}) {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const amount = Number(input.amount);
  const date = parseDate(input.date);
  const sourceName = clean(input.sourceName);
  const reference = clean(input.reference);
  const memo = clean(input.memo);

  if (input.mode !== "deposit" && input.mode !== "cheque") {
    return { success: false, error: "Transaction type is invalid" };
  }
  if (!input.bankAccountId) {
    return { success: false, error: "Cash or bank account is required" };
  }
  if (!date) return { success: false, error: "Enter a valid transaction date" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }
  if (!sourceName) return { success: false, error: "Source name is required" };
  if (!["Customer", "Supplier", "Employee", "Other"].includes(input.sourceType)) {
    return { success: false, error: "Classify the source before posting" };
  }

  try {
    const result = await withTenantTransaction(user.organizationId, async (tx) => {
      const bank = await tx.bankAccount.findFirst({
        where: { id: input.bankAccountId, isActive: true },
        select: {
          id: true,
          accountId: true,
          name: true,
          bankName: true,
          account: {
            select: {
              id: true,
              isActive: true,
              isBank: true,
              type: true,
              branchId: true,
            },
          },
        },
      });
      if (
        !bank ||
        !bank.account.isActive ||
        !bank.account.isBank ||
        bank.account.type !== "ASSET"
      ) {
        throw new Error("Cash or bank account not found in your organization");
      }

      const branchId =
        clean(input.branchId) || bank.account.branchId || user.branches[0]?.id || null;
      if (branchId) {
        const branch = await tx.branch.findFirst({
          where: { id: branchId },
          select: { id: true },
        });
        if (!branch) throw new Error("Pick a valid transaction class");
      }

      const systemAccounts = await getSystemAccounts(tx);
      const isDeposit = input.mode === "deposit";
      const journalSource = isDeposit ? "PAYMENT_RECEIVED" : "PAYMENT_MADE";
      const commonDescription = [sourceName, memo].filter(Boolean).join(" - ");
      let journalLines: {
        accountId: string;
        debit?: number;
        credit?: number;
        description?: string;
      }[] = [];
      let paymentNumber: string | undefined;
      let entityId: string | null = input.sourceId ?? null;
      let transactionKind = `${input.mode}:${input.sourceType}`;

      if (input.sourceType === "Customer") {
        if (!entityId) throw new Error("Select an existing customer");
        const customer = await tx.customer.findFirst({
          where: { id: entityId },
          select: { id: true, name: true },
        });
        if (!customer) throw new Error("Customer not found in your organization");
        entityId = customer.id;
        const receivableId = systemAccounts[SYSTEM_ACCOUNT_KEYS.ACCOUNTS_RECEIVABLE];
        if (!receivableId) {
          throw new Error("Accounts Receivable is missing. Set up the chart of accounts.");
        }
        paymentNumber = await nextPaymentNumber(tx, isDeposit ? "RECEIVED" : "PAID");
        journalLines = isDeposit
          ? [
              { accountId: bank.accountId, debit: amount, description: commonDescription || "Customer receipt" },
              { accountId: receivableId, credit: amount, description: `Settle debtor - ${customer.name}` },
            ]
          : [
              { accountId: receivableId, debit: amount, description: `Customer refund - ${customer.name}` },
              { accountId: bank.accountId, credit: amount, description: commonDescription || "Customer refund" },
            ];
      } else if (input.sourceType === "Supplier") {
        if (!entityId) throw new Error("Select an existing supplier");
        const supplier = await tx.supplier.findFirst({
          where: { id: entityId },
          select: { id: true, name: true },
        });
        if (!supplier) throw new Error("Supplier not found in your organization");
        entityId = supplier.id;
        const payableId = systemAccounts[SYSTEM_ACCOUNT_KEYS.ACCOUNTS_PAYABLE];
        if (!payableId) {
          throw new Error("Accounts Payable is missing. Set up the chart of accounts.");
        }
        paymentNumber = await nextPaymentNumber(tx, isDeposit ? "RECEIVED" : "PAID");
        journalLines = isDeposit
          ? [
              { accountId: bank.accountId, debit: amount, description: commonDescription || "Supplier refund" },
              { accountId: payableId, credit: amount, description: `Supplier refund - ${supplier.name}` },
            ]
          : [
              { accountId: payableId, debit: amount, description: `Settle creditor - ${supplier.name}` },
              { accountId: bank.accountId, credit: amount, description: commonDescription || "Supplier payment" },
            ];
      } else if (input.sourceType === "Employee") {
        if (!entityId) throw new Error("Select an existing employee");
        const employee = await tx.user.findFirst({
          where: { id: entityId },
          select: { id: true, name: true, email: true },
        });
        if (!employee) throw new Error("Employee not found in your organization");
        entityId = employee.id;
        const employeeReceivableId =
          systemAccounts[SYSTEM_ACCOUNT_KEYS.EMPLOYEE_RECEIVABLES];
        const employeePayableId = systemAccounts[SYSTEM_ACCOUNT_KEYS.EMPLOYEE_PAYABLES];
        const employeeKind: EmployeePostingKind = isDeposit
          ? "ADVANCE_REPAID"
          : input.employeePostingKind === "REIMBURSEMENT_PAID"
            ? "REIMBURSEMENT_PAID"
            : "ADVANCE_PAID";
        transactionKind = `${input.mode}:Employee:${employeeKind}`;
        journalLines = buildEmployeeCashBookLines({
          kind: employeeKind,
          amount,
          bankAccountId: bank.accountId,
          employeeReceivableAccountId: employeeReceivableId,
          employeePayableAccountId: employeePayableId,
          memo: commonDescription || employee.name || employee.email,
        });
      } else if (isDeposit) {
        const incomeAccountId = clean(input.incomeAccountId);
        if (!incomeAccountId) throw new Error("Select a revenue account");
        const incomeAccount = await tx.chartAccount.findFirst({
          where: {
            id: incomeAccountId,
            isActive: true,
            type: "INCOME",
            normalBalance: "CREDIT",
          },
          select: { id: true },
        });
        if (!incomeAccount) throw new Error("Pick a valid revenue account");
        journalLines = [
          { accountId: bank.accountId, debit: amount, description: commonDescription || "Deposit received" },
          { accountId: incomeAccount.id, credit: amount, description: commonDescription || "Other income" },
        ];
      } else {
        const expenseAccountId = clean(input.expenseAccountId);
        if (!expenseAccountId) throw new Error("Select an expense account");
        const expenseAccount = await tx.chartAccount.findFirst({
          where: {
            id: expenseAccountId,
            isActive: true,
            type: "EXPENSE",
            normalBalance: "DEBIT",
          },
          select: { id: true },
        });
        if (!expenseAccount) throw new Error("Pick a valid expense account");
        journalLines = [
          { accountId: expenseAccount.id, debit: amount, description: commonDescription || "Expense" },
          { accountId: bank.accountId, credit: amount, description: commonDescription || "Payment made" },
        ];
      }

      const journalSourceId =
        paymentNumber ??
        (input.sourceType === "Employee" && entityId
          ? `${entityId}:${reference || crypto.randomUUID()}`
          : reference || null);

      const entry = await postJournalEntry(
        tx,
        user.organizationId,
        {
          date,
          memo:
            memo ||
            `${isDeposit ? "Receipt" : "Payment"} - ${sourceName}`,
          source: journalSource,
          sourceType: transactionKind,
          sourceId: journalSourceId,
          branchId,
          lines: journalLines,
        },
        user.id,
      );

      if (input.sourceType === "Customer" || input.sourceType === "Supplier") {
        const direction = isDeposit ? "RECEIVED" : "PAID";
        paymentNumber ??= await nextPaymentNumber(tx, direction);
        await tx.payment.create({
          data: {
            paymentNumber,
            direction,
            method: input.mode === "cheque" ? "CHEQUE" : "BANK_TRANSFER",
            date,
            amount,
            reference: reference || null,
            notes: [sourceName, memo].filter(Boolean).join(" - ") || null,
            customerId: input.sourceType === "Customer" ? entityId : null,
            supplierId: input.sourceType === "Supplier" ? entityId : null,
            bankAccountId: bank.id,
            journalEntryId: entry.id,
            createdBy: user.id,
          },
        });
      }

      await writeAccountingAudit(tx, user, {
        action: "ACCOUNTING_CASH_BOOK_TRANSACTION_POSTED",
        entityType: "JournalEntry",
        entityId: entry.id,
        transactionReference: paymentNumber ?? entry.entryNumber,
        newValues: {
          mode: input.mode,
          amount,
          date: date.toISOString().slice(0, 10),
          bankAccountId: bank.id,
          bankAccountName: bank.name,
          sourceName,
          sourceType: input.sourceType,
          sourceId: entityId,
          reference: reference || null,
          journalEntryNumber: entry.entryNumber,
        },
      });

      return {
        entryNumber: entry.entryNumber,
        paymentNumber,
      };
    });

    revalidateAccountingWorkspace();
    return { success: true, ...result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not post cash-book transaction",
    };
  }
}

export async function postCashBookJournal(input: {
  bankAccountId: string;
  date: string;
  amount: number;
  branchId?: string | null;
  reference?: string;
  memo?: string;
  cashSide: "DEBIT" | "CREDIT";
  counterpartAccountId: string;
}) {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const amount = Number(input.amount);
  const date = parseDate(input.date);

  if (!input.bankAccountId) return { success: false, error: "Cash account is required" };
  if (!date) return { success: false, error: "Enter a valid transaction date" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }
  if (input.cashSide !== "DEBIT" && input.cashSide !== "CREDIT") {
    return { success: false, error: "Cash side is invalid" };
  }

  try {
    const entry = await withTenantTransaction(user.organizationId, async (tx) => {
      const bank = await tx.bankAccount.findFirst({
        where: { id: input.bankAccountId, isActive: true },
        select: {
          accountId: true,
          account: { select: { isActive: true, isBank: true } },
        },
      });
      if (!bank || !bank.account.isActive || !bank.account.isBank) {
        throw new Error("Cash account not found in your organization");
      }

      const counterpart = await tx.chartAccount.findFirst({
        where: { id: input.counterpartAccountId, isActive: true },
        select: { id: true },
      });
      if (!counterpart) throw new Error("Pick a valid counter account");
      if (counterpart.id === bank.accountId) {
        throw new Error("Counter account must differ from the cash account");
      }

      const branchId = clean(input.branchId) || user.branches[0]?.id;
      const branch = branchId
        ? await tx.branch.findFirst({
            where: { id: branchId },
            select: { id: true },
          })
        : null;
      if (branchId && !branch) {
        throw new Error("Pick a valid transaction class");
      }

      const entry = await postJournalEntry(
        tx,
        user.organizationId,
        {
          date,
          memo: clean(input.memo) || clean(input.reference) || "Cash-book journal",
          source: "MANUAL",
          sourceType: "CashBookJournal",
          sourceId: clean(input.reference) || null,
          branchId: branch?.id ?? null,
          lines:
            input.cashSide === "DEBIT"
              ? [
                  {
                    accountId: bank.accountId,
                    debit: round2(amount),
                    description: clean(input.memo) || "Cash-book debit",
                  },
                  {
                    accountId: counterpart.id,
                    credit: round2(amount),
                    description: clean(input.memo) || "Counter entry",
                  },
                ]
              : [
                  {
                    accountId: counterpart.id,
                    debit: round2(amount),
                    description: clean(input.memo) || "Counter entry",
                  },
                  {
                    accountId: bank.accountId,
                    credit: round2(amount),
                    description: clean(input.memo) || "Cash-book credit",
                  },
                ],
        },
        user.id,
      );

      await writeAccountingAudit(tx, user, {
        action: "ACCOUNTING_CASH_BOOK_JOURNAL_POSTED",
        entityType: "JournalEntry",
        entityId: entry.id,
        transactionReference: entry.entryNumber,
        newValues: {
          bankAccountId: input.bankAccountId,
          cashSide: input.cashSide,
          counterpartAccountId: counterpart.id,
          amount,
          date: date.toISOString().slice(0, 10),
          reference: clean(input.reference) || null,
        },
      });

      return entry;
    });

    revalidateAccountingWorkspace();
    return { success: true, entryNumber: entry.entryNumber };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not post cash-book journal",
    };
  }
}
