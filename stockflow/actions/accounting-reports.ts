"use server";

import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { SYSTEM_ACCOUNT_KEYS } from "@/lib/accounting/chart-of-accounts";
import { getTenantPrisma } from "@/lib/tenant-prisma";

type ReportDb = Pick<
  Prisma.TransactionClient,
  "chartAccount" | "ledgerLine" | "saleOrder"
>;

type ReportRow = {
  code: string;
  name: string;
  amount: number;
};

type ReportDateRange = {
  from: string | null;
  to: string;
  journalWhere: Prisma.JournalEntryWhereInput;
  saleWhere: Prisma.SaleOrderWhereInput;
};

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function parseDate(value: string, endOfDay = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const date = new Date(`${value}${suffix}`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }
  return date;
}

function getReportDateRange(input?: {
  from?: string;
  to?: string;
}): ReportDateRange {
  const to = input?.to ?? new Date().toISOString().slice(0, 10);
  const fromDate = input?.from ? parseDate(input.from) : null;
  const toDate = parseDate(to, true);

  if (input?.from && !fromDate) throw new Error("Invalid report start date");
  if (!toDate) throw new Error("Invalid report end date");
  if (fromDate && fromDate > toDate) {
    throw new Error("Report start date must be before end date");
  }

  const date = {
    ...(fromDate ? { gte: fromDate } : {}),
    lte: toDate,
  };

  return {
    from: input?.from ?? null,
    to,
    journalWhere: { date },
    saleWhere: { createdAt: date },
  };
}

async function ledgerSums(
  db: Pick<ReportDb, "ledgerLine">,
  journalWhere: Prisma.JournalEntryWhereInput,
) {
  const lines = await db.ledgerLine.findMany({
    where: { journalEntry: { status: "POSTED", ...journalWhere } },
    select: { accountId: true, debit: true, credit: true },
  });

  const totalsByAccount = new Map<
    string,
    { debit: number; credit: number }
  >();
  for (const line of lines) {
    const totals = totalsByAccount.get(line.accountId) ?? {
      debit: 0,
      credit: 0,
    };
    totals.debit += Number(line.debit);
    totals.credit += Number(line.credit);
    totalsByAccount.set(line.accountId, totals);
  }
  return totalsByAccount;
}

async function buildProfitAndLoss(
  db: Pick<ReportDb, "chartAccount" | "ledgerLine">,
  range: ReportDateRange,
) {
  const [accounts, sums] = await Promise.all([
    db.chartAccount.findMany({
      where: { type: { in: ["INCOME", "EXPENSE"] } },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        description: true,
      },
    }),
    ledgerSums(db, range.journalWhere),
  ]);

  const income: ReportRow[] = [];
  const expenses: ReportRow[] = [];
  let totalIncome = 0;
  let costOfSales = 0;
  let totalOperatingExpenses = 0;

  for (const account of accounts) {
    const totals = sums.get(account.id) ?? { debit: 0, credit: 0 };
    if (account.type === "INCOME") {
      const amount = totals.credit - totals.debit;
      if (amount !== 0) {
        income.push({
          code: account.code,
          name: account.name,
          amount: round2(amount),
        });
        totalIncome += amount;
      }
      continue;
    }

    const amount = totals.debit - totals.credit;
    if (amount === 0) continue;

    const isCostOfSales =
      account.description === `key:${SYSTEM_ACCOUNT_KEYS.COST_OF_SALES}` ||
      account.code === "5000";
    if (isCostOfSales) {
      costOfSales += amount;
    } else {
      expenses.push({
        code: account.code,
        name: account.name,
        amount: round2(amount),
      });
      totalOperatingExpenses += amount;
    }
  }

  const grossProfit = totalIncome - costOfSales;
  const totalExpenses = costOfSales + totalOperatingExpenses;
  const netProfit = totalIncome - totalExpenses;

  return {
    from: range.from,
    to: range.to,
    income,
    expenses,
    totalIncome: round2(totalIncome),
    costOfSales: round2(costOfSales),
    grossProfit: round2(grossProfit),
    totalOperatingExpenses: round2(totalOperatingExpenses),
    totalExpenses: round2(totalExpenses),
    totalExpense: round2(totalExpenses),
    netProfit: round2(netProfit),
    grossMargin: totalIncome
      ? round2((grossProfit / totalIncome) * 100)
      : 0,
    netMargin: totalIncome ? round2((netProfit / totalIncome) * 100) : 0,
  };
}

export async function getProfitAndLoss(input?: {
  from?: string;
  to?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  return buildProfitAndLoss(db, getReportDateRange(input));
}

export async function getBalanceSheet(input?: { asOf?: string }) {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const asOf = input?.asOf ?? new Date().toISOString().slice(0, 10);
  const asOfDate = input?.asOf ? parseDate(input.asOf, true) : new Date();
  if (!asOfDate) throw new Error("Invalid balance sheet date");

  const [accounts, sums] = await Promise.all([
    db.chartAccount.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    }),
    ledgerSums(db, { date: { lte: asOfDate } }),
  ]);

  const assets: ReportRow[] = [];
  const liabilities: ReportRow[] = [];
  const equity: ReportRow[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let unclosedIncome = 0;
  let unclosedExpenses = 0;

  for (const account of accounts) {
    const totals = sums.get(account.id) ?? { debit: 0, credit: 0 };
    if (account.type === "ASSET") {
      const amount = totals.debit - totals.credit;
      if (amount !== 0) {
        assets.push({
          code: account.code,
          name: account.name,
          amount: round2(amount),
        });
        totalAssets += amount;
      }
    } else if (account.type === "LIABILITY") {
      const amount = totals.credit - totals.debit;
      if (amount !== 0) {
        liabilities.push({
          code: account.code,
          name: account.name,
          amount: round2(amount),
        });
        totalLiabilities += amount;
      }
    } else if (account.type === "EQUITY") {
      const amount = totals.credit - totals.debit;
      if (amount !== 0) {
        equity.push({
          code: account.code,
          name: account.name,
          amount: round2(amount),
        });
        totalEquity += amount;
      }
    } else if (account.type === "INCOME") {
      unclosedIncome += totals.credit - totals.debit;
    } else if (account.type === "EXPENSE") {
      unclosedExpenses += totals.debit - totals.credit;
    }
  }

  const unclosedEarnings = unclosedIncome - unclosedExpenses;
  if (unclosedEarnings !== 0) {
    equity.push({
      code: "-",
      name: "Unclosed Earnings",
      amount: round2(unclosedEarnings),
    });
    totalEquity += unclosedEarnings;
  }

  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    asOf,
    assets,
    liabilities,
    equity,
    totalAssets: round2(totalAssets),
    totalLiabilities: round2(totalLiabilities),
    totalEquity: round2(totalEquity),
    totalLiabilitiesAndEquity: round2(totalLiabilitiesAndEquity),
    totalLiabAndEquity: round2(totalLiabilitiesAndEquity),
    balanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
  };
}

export async function getFinancialInsights(input?: {
  from?: string;
  to?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const range = getReportDateRange(input);

  const [profitAndLoss, sales] = await Promise.all([
    buildProfitAndLoss(db, range),
    db.saleOrder.findMany({
      where: {
        status: { in: ["CONFIRMED", "READY_FOR_DISPATCH", "SHIPPED"] },
        ...range.saleWhere,
      },
      select: { customerId: true, customerName: true, totalAmount: true },
    }),
  ]);

  const byCustomer = new Map<string, { name: string; amount: number }>();
  let totalSales = 0;
  for (const sale of sales) {
    const amount = Number(sale.totalAmount);
    const name = sale.customerName || "Unknown customer";
    const key = sale.customerId ?? `name:${name}`;
    const customer = byCustomer.get(key) ?? { name, amount: 0 };
    customer.amount += amount;
    byCustomer.set(key, customer);
    totalSales += amount;
  }

  const concentration = [...byCustomer.entries()]
    .map(([key, customer]) => ({
      key,
      name: customer.name,
      amount: round2(customer.amount),
      share: totalSales
        ? round2((customer.amount / totalSales) * 100)
        : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const topShare = concentration[0]?.share ?? 0;
  const concentrationRisk =
    topShare >= 50 ? "HIGH" : topShare >= 30 ? "MEDIUM" : "LOW";

  return {
    profitAndLoss,
    pl: profitAndLoss,
    totalSales: round2(totalSales),
    concentration,
    topCustomer: concentration[0] ?? null,
    concentrationRisk,
    customerCount: byCustomer.size,
  };
}
