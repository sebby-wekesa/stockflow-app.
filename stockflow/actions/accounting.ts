"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { requireUserBranchClass } from "@/lib/accounting/branch-class";
import { KENYA_SME_CHART } from "@/lib/accounting/chart-of-accounts";
import { postJournalEntry } from "@/lib/accounting/posting";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
const NORMAL_BALANCES = ["DEBIT", "CREDIT"] as const;

type SeededAccountRow = {
  id: string;
  code: string;
  type: string;
  normalBalance: string;
  isBank: boolean;
  isSystem: boolean;
  description: string | null;
  bankAccount: { id: string } | null;
};

function parseDate(value: string, endOfDay = false): Date | null {
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function seedChartOfAccounts() {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");

  const result = await withTenantTransaction(user.organizationId, async (tx) => {
    const existing = await tx.chartAccount.findMany({
      select: {
        id: true,
        code: true,
        type: true,
        normalBalance: true,
        isBank: true,
        isSystem: true,
        description: true,
        bankAccount: { select: { id: true } },
      },
    }) as SeededAccountRow[];
    const byCode = new Map<string, SeededAccountRow>(
      existing.map((account) => [account.code, account]),
    );

    let created = 0;
    let bankAccountsCreated = 0;
    for (const seed of KENYA_SME_CHART) {
      let account = byCode.get(seed.code);
      if (!account) {
        account = await tx.chartAccount.create({
          data: {
            organizationId: user.organizationId,
            code: seed.code,
            name: seed.name,
            type: seed.type,
            normalBalance: seed.normalBalance,
            isBank: seed.isBank ?? false,
            isSystem: Boolean(seed.key),
            description: seed.key ? `key:${seed.key}` : null,
          },
          select: {
            id: true,
            code: true,
            type: true,
            normalBalance: true,
            isBank: true,
            isSystem: true,
            description: true,
            bankAccount: { select: { id: true } },
          },
        }) as SeededAccountRow;
        byCode.set(seed.code, account);
        created += 1;
      } else {
        if (
          seed.key &&
          (account.type !== seed.type ||
            account.normalBalance !== seed.normalBalance)
        ) {
          throw new Error(
            `Existing account ${seed.code} is incompatible with required system account ${seed.name}`,
          );
        }

        const systemDescription = seed.key ? `key:${seed.key}` : null;
        const needsUpdate =
          (seed.isBank && !account.isBank) ||
          (seed.key &&
            (!account.isSystem || account.description !== systemDescription));
        if (needsUpdate) {
          account = await tx.chartAccount.update({
            where: { id: account.id },
            data: {
              ...(seed.isBank ? { isBank: true } : {}),
              ...(seed.key
                ? { isSystem: true, description: systemDescription }
                : {}),
            },
            select: {
              id: true,
              code: true,
              type: true,
              normalBalance: true,
              isBank: true,
              isSystem: true,
              description: true,
              bankAccount: { select: { id: true } },
            },
          }) as SeededAccountRow;
          byCode.set(seed.code, account);
        }
      }

      if (seed.isBank && !account.bankAccount) {
        await tx.bankAccount.create({
          data: {
            organizationId: user.organizationId,
            accountId: account.id,
            name: seed.name,
          },
        });
        bankAccountsCreated += 1;
      }
    }

    return {
      created,
      bankAccountsCreated,
      total: KENYA_SME_CHART.length,
    };
  });

  revalidatePath("/accounting");
  revalidatePath("/accounting/chart");
  revalidatePath("/accounting/banking");
  return { success: true, ...result };
}

export async function listAccounts() {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  return db.chartAccount.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      normalBalance: true,
      isBank: true,
      isSystem: true,
      isActive: true,
    },
  });
}

export async function createAccount(input: {
  code: string;
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  normalBalance?: (typeof NORMAL_BALANCES)[number];
}) {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const code = input.code.trim();
  const name = input.name.trim();

  if (!code || !name) {
    return { success: false, error: "Code and name are required" };
  }
  if (!ACCOUNT_TYPES.includes(input.type)) {
    return { success: false, error: "Account type is invalid" };
  }
  if (
    input.normalBalance &&
    !NORMAL_BALANCES.includes(input.normalBalance)
  ) {
    return { success: false, error: "Normal balance is invalid" };
  }

  const clash = await db.chartAccount.findFirst({ where: { code } });
  if (clash) {
    return {
      success: false,
      error: `Account code ${code} already exists`,
    };
  }

  const normalBalance =
    input.normalBalance ??
    (input.type === "ASSET" || input.type === "EXPENSE" ? "DEBIT" : "CREDIT");
  const account = await db.chartAccount.create({
    data: {
      organizationId: user.organizationId,
      code,
      name,
      type: input.type,
      normalBalance,
    },
  });
  revalidatePath("/accounting/chart");
  return { success: true, accountId: account.id };
}

export async function updateAccount(
  id: string,
  input: { name?: string; isActive?: boolean },
) {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const account = await db.chartAccount.findFirst({ where: { id } });
  if (!account) return { success: false, error: "Account not found" };
  if (account.isSystem && input.isActive === false) {
    return { success: false, error: "System accounts cannot be deactivated" };
  }

  const name = input.name?.trim();
  if (input.name != null && !name) {
    return { success: false, error: "Account name is required" };
  }

  await db.chartAccount.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(input.isActive != null ? { isActive: input.isActive } : {}),
    },
  });
  revalidatePath("/accounting/chart");
  return { success: true };
}

export async function createManualJournal(input: {
  date: string;
  memo?: string;
  lines: {
    accountId: string;
    debit?: number;
    credit?: number;
    description?: string;
  }[];
}) {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const date = parseDate(input.date);
  if (!date) return { success: false, error: "Enter a valid journal date" };

  try {
    const entry = await withTenantTransaction(user.organizationId, async (tx) => {
      const branchClass = await requireUserBranchClass(tx, user);
      return postJournalEntry(
        tx,
        user.organizationId,
        {
          date,
          memo: input.memo,
          source: "MANUAL",
          branchId: branchClass.id,
          lines: input.lines,
        },
        user.id,
      );
    });
    revalidatePath("/accounting");
    revalidatePath("/accounting/journal");
    revalidatePath("/accounting/ledger");
    revalidatePath("/accounting/trial-balance");
    return { success: true, entryNumber: entry.entryNumber };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not post journal entry",
    };
  }
}

export async function getTrialBalance(asOf?: string) {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const asOfDate = asOf ? parseDate(asOf, true) : null;
  if (asOf && !asOfDate) throw new Error("Invalid trial balance date");

  const [accounts, lines] = await Promise.all([
    db.chartAccount.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    }),
    db.ledgerLine.findMany({
      where: {
        journalEntry: {
          status: "POSTED",
          ...(asOfDate ? { date: { lte: asOfDate } } : {}),
        },
      },
      select: { accountId: true, debit: true, credit: true },
    }),
  ]);

  const totalsByAccount = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    const totals = totalsByAccount.get(line.accountId) ?? {
      debit: 0,
      credit: 0,
    };
    totals.debit += Number(line.debit);
    totals.credit += Number(line.credit);
    totalsByAccount.set(line.accountId, totals);
  }

  let totalDebit = 0;
  let totalCredit = 0;
  const rows = accounts.flatMap((account) => {
    const totals = totalsByAccount.get(account.id) ?? { debit: 0, credit: 0 };
    const net = totals.debit - totals.credit;
    if (Math.abs(net) < 0.005 && totals.debit === 0 && totals.credit === 0) {
      return [];
    }

    const debit = net > 0 ? net : 0;
    const credit = net < 0 ? -net : 0;
    totalDebit += debit;
    totalCredit += credit;
    return [{
      code: account.code,
      name: account.name,
      type: account.type,
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
    }];
  });

  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;
  return {
    asOf: asOf ?? new Date().toISOString().slice(0, 10),
    rows,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

export async function getGeneralLedger(input: {
  accountId?: string;
  from?: string;
  to?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const accounts = await db.chartAccount.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, type: true, normalBalance: true },
  });

  if (!input.accountId) {
    return { accounts, accountId: null, lines: [], openingBalance: 0, account: null };
  }

  const account = accounts.find((candidate) => candidate.id === input.accountId) ?? null;
  if (!account) {
    return { accounts, accountId: input.accountId, lines: [], openingBalance: 0, account: null };
  }

  const from = input.from ? parseDate(input.from) : null;
  const to = input.to ? parseDate(input.to, true) : null;
  if (input.from && !from) throw new Error("Invalid ledger start date");
  if (input.to && !to) throw new Error("Invalid ledger end date");
  if (from && to && from > to) throw new Error("Ledger start date must be before end date");

  let openingBalance = 0;
  if (from) {
    const prior = await db.ledgerLine.findMany({
      where: {
        accountId: input.accountId,
        journalEntry: { status: "POSTED", date: { lt: from } },
      },
      select: { debit: true, credit: true },
    });
    const debit = prior.reduce((sum, line) => sum + Number(line.debit), 0);
    const credit = prior.reduce((sum, line) => sum + Number(line.credit), 0);
    openingBalance =
      account.normalBalance === "DEBIT" ? debit - credit : credit - debit;
  }

  const ledgerLines = await db.ledgerLine.findMany({
    where: {
      accountId: input.accountId,
      journalEntry: {
        status: "POSTED",
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
    },
    include: {
      journalEntry: {
        select: {
          entryNumber: true,
          date: true,
          memo: true,
          source: true,
          Branch: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: [{ journalEntry: { date: "asc" } }, { createdAt: "asc" }],
  });

  let running = openingBalance;
  const lines = ledgerLines.map((line) => {
    const debit = Number(line.debit);
    const credit = Number(line.credit);
    running +=
      account.normalBalance === "DEBIT" ? debit - credit : credit - debit;
    return {
      date: line.journalEntry.date,
      entryNumber: line.journalEntry.entryNumber,
      memo: line.description ?? line.journalEntry.memo,
      source: line.journalEntry.source,
      branchClass: line.journalEntry.Branch
        ? {
            code: line.journalEntry.Branch.code,
            name: line.journalEntry.Branch.name,
          }
        : null,
      debit,
      credit,
      balance: Math.round(running * 100) / 100,
    };
  });

  return {
    accounts,
    accountId: input.accountId,
    account,
    openingBalance: Math.round(openingBalance * 100) / 100,
    lines,
  };
}
