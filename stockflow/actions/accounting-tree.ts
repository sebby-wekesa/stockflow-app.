"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";
import {
  CLASSIFICATION_MAP,
  STATEMENT_GROUPS,
  type AccountType,
  type Classification,
  type StatementGroup,
} from "@/lib/accounting/classifications";

const ACCOUNTING_ROLES = ["ADMIN", "MANAGER", "ACCOUNTS"] as const;

function amountForStatementSide(
  type: AccountType,
  debit: number,
  credit: number,
) {
  if (type === "LIABILITY" || type === "EQUITY" || type === "INCOME") {
    return credit - debit;
  }
  return debit - credit;
}

function resolveGroup(account: {
  type: string;
  code: string;
  classification?: string | null;
  statementGroup?: string | null;
}): StatementGroup {
  if (account.statementGroup) return account.statementGroup as StatementGroup;
  if (
    account.classification &&
    CLASSIFICATION_MAP[account.classification as Classification]
  ) {
    return CLASSIFICATION_MAP[account.classification as Classification].group;
  }

  switch (account.type) {
    case "ASSET":
      return account.code.startsWith("15")
        ? "NON_CURRENT_ASSETS"
        : "CURRENT_ASSETS";
    case "LIABILITY":
      return account.code.startsWith("23")
        ? "NON_CURRENT_LIABILITIES"
        : "CURRENT_LIABILITIES";
    case "EQUITY":
      return "EQUITY";
    case "INCOME":
      return account.code === "4000" ? "REVENUE" : "OTHER_INCOME";
    case "EXPENSE":
      if (account.code === "5000") return "COST_OF_GOODS_SOLD";
      if (account.code === "5400") return "FINANCE_CHARGES";
      return "ADMINISTRATIVE_EXPENSES";
    default:
      return "CURRENT_ASSETS";
  }
}

async function nextAccountCode(tx: any, type: AccountType) {
  const band: Record<AccountType, number> = {
    ASSET: 1000,
    LIABILITY: 2000,
    EQUITY: 3000,
    INCOME: 4000,
    EXPENSE: 5000,
  };
  const base = band[type];
  const existing = await tx.chartAccount.findMany({
    where: { type },
    select: { code: true },
  });

  let maxCode = base;
  for (const account of existing) {
    const numericCode = Number.parseInt(account.code, 10);
    if (
      Number.isFinite(numericCode) &&
      numericCode >= base &&
      numericCode < base + 1000 &&
      numericCode > maxCode
    ) {
      maxCode = numericCode;
    }
  }

  let code = String(maxCode + 10);
  for (let i = 0; i < 200; i += 1) {
    const clash = await tx.chartAccount.findFirst({ where: { code } });
    if (!clash) return code;
    code = String(Number.parseInt(code, 10) + 1);
  }
  throw new Error("Could not generate a unique account code");
}

export async function createClassifiedAccount(input: {
  name: string;
  currency?: string;
  classification: Classification;
  statementGroup?: StatementGroup | null;
  parentId?: string | null;
  description?: string | null;
  note?: string | null;
  vatApplicable?: boolean;
}) {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const name = input.name.trim();
  if (!name) return { success: false, error: "Account name is required" };

  const mapping = CLASSIFICATION_MAP[input.classification];
  if (!mapping) {
    return { success: false, error: "Pick a valid classification" };
  }

  try {
    const account = await withTenantTransaction(user.organizationId, async (tx) => {
      if (input.parentId) {
        const parent = await tx.chartAccount.findFirst({
          where: { id: input.parentId, isActive: true },
          select: { id: true },
        });
        if (!parent) throw new Error("Selected parent account not found");
      }

      const code = await nextAccountCode(tx, mapping.type);
      const created = await tx.chartAccount.create({
        data: {
          code,
          name,
          type: mapping.type,
          normalBalance: mapping.normalBalance,
          classification: input.classification,
          statementGroup: input.statementGroup || mapping.group,
          currency: input.currency?.trim() || "KES",
          parentId: input.parentId || null,
          description: input.description?.trim() || null,
          note: input.note?.trim() || null,
          vatApplicable: Boolean(input.vatApplicable),
          isBank: input.classification === "BANK",
        },
        select: { id: true, code: true },
      });

      if (input.classification === "BANK") {
        await tx.bankAccount.create({
          data: {
            accountId: created.id,
            name,
            currency: input.currency?.trim() || "KES",
          },
        });
      }

      return created;
    });

    revalidatePath("/accounting");
    revalidatePath("/accounting/chart");
    revalidatePath("/accounting/banking");
    return { success: true, accountId: account.id, code: account.code };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not create account",
    };
  }
}

export async function getAccountTree() {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const db = getTenantPrisma(user.organizationId);

  const [accounts, lines] = await Promise.all([
    db.chartAccount.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalBalance: true,
        classification: true,
        statementGroup: true,
        currency: true,
        vatApplicable: true,
        parentId: true,
      },
    }),
    db.ledgerLine.findMany({
      where: { journalEntry: { status: "POSTED" } },
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

  const byGroup = new Map<StatementGroup, any[]>();
  for (const account of accounts) {
    const group = resolveGroup(account);
    const totals = totalsByAccount.get(account.id) ?? { debit: 0, credit: 0 };
    const balance = amountForStatementSide(
      account.type as AccountType,
      totals.debit,
      totals.credit,
    );

    const rows = byGroup.get(group) ?? [];
    rows.push({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      classification: account.classification,
      classificationLabel: account.classification
        ? CLASSIFICATION_MAP[account.classification as Classification]?.label ??
          account.classification
        : account.type,
      currency: account.currency ?? "KES",
      vatApplicable: account.vatApplicable,
      parentId: account.parentId,
      balance: Math.round(balance * 100) / 100,
    });
    byGroup.set(group, rows);
  }

  return STATEMENT_GROUPS.map((group) => {
    const accountsInGroup = byGroup.get(group.key) ?? [];
    const total = accountsInGroup.reduce(
      (sum, account) => sum + account.balance,
      0,
    );
    return {
      key: group.key,
      label: group.label,
      statement: group.statement,
      accounts: accountsInGroup,
      total: Math.round(total * 100) / 100,
    };
  });
}

export async function getParentAccountOptions() {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const db = getTenantPrisma(user.organizationId);
  const accounts = await db.chartAccount.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  return accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
  }));
}
