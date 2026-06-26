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

function isStatementGroup(value: string): value is StatementGroup {
  return STATEMENT_GROUPS.some((group) => group.key === value);
}

function resolveStatementGroup(
  value: StatementGroup | null | undefined,
  fallback: StatementGroup,
) {
  if (!value) return fallback;
  if (!isStatementGroup(value)) {
    throw new Error("Pick a valid report category");
  }
  return value;
}

function revalidateAccountingPaths() {
  revalidatePath("/accounting");
  revalidatePath("/accounting/chart");
  revalidatePath("/accounting/banking");
  revalidatePath("/accounting/transactions");
  revalidatePath("/accounting/ledger");
  revalidatePath("/accounting/trial-balance");
  revalidatePath("/accounting/profit-loss");
  revalidatePath("/accounting/balance-sheet");
}

async function resolveBranchId(tx: any, branchId?: string | null) {
  const trimmed = branchId?.trim();
  if (!trimmed) return null;

  const branch = await tx.branch.findFirst({
    where: { id: trimmed },
    select: { id: true },
  });
  if (!branch) throw new Error("Selected branch not found");
  return branch.id;
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
  branchId?: string | null;
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
    const statementGroup = resolveStatementGroup(
      input.statementGroup,
      mapping.group,
    );

    const account = await withTenantTransaction(user.organizationId, async (tx) => {
      const branchId = await resolveBranchId(tx, input.branchId);

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
          statementGroup,
          currency: input.currency?.trim() || "KES",
          branchId,
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

    revalidateAccountingPaths();
    return { success: true, accountId: account.id, code: account.code };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not create account",
    };
  }
}

export async function updateClassifiedAccount(input: {
  id: string;
  name: string;
  currency?: string;
  classification: Classification;
  statementGroup?: StatementGroup | null;
  branchId?: string | null;
  parentId?: string | null;
  description?: string | null;
  note?: string | null;
  vatApplicable?: boolean;
}) {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const id = input.id.trim();
  const name = input.name.trim();

  if (!id) return { success: false, error: "Account is required" };
  if (!name) return { success: false, error: "Account name is required" };

  const mapping = CLASSIFICATION_MAP[input.classification];
  if (!mapping) {
    return { success: false, error: "Pick a valid classification" };
  }

  try {
    const statementGroup = resolveStatementGroup(
      input.statementGroup,
      mapping.group,
    );
    const currency = input.currency?.trim() || "KES";
    const parentId = input.parentId || null;

    await withTenantTransaction(user.organizationId, async (tx) => {
      const branchId = await resolveBranchId(tx, input.branchId);
      const account = await tx.chartAccount.findFirst({
        where: { id, isActive: true },
        select: {
          id: true,
          isSystem: true,
          isBank: true,
          bankAccount: { select: { id: true } },
        },
      });
      if (!account) throw new Error("Account not found");
      if (account.isSystem) {
        throw new Error("System accounts cannot be edited here");
      }

      if (parentId) {
        if (parentId === id) {
          throw new Error("An account cannot be its own sub-account");
        }

        let parent = await tx.chartAccount.findFirst({
          where: { id: parentId, isActive: true },
          select: { id: true, parentId: true },
        });
        if (!parent) throw new Error("Selected parent account not found");

        while (parent?.parentId) {
          if (parent.parentId === id) {
            throw new Error("An account cannot be moved below one of its sub-accounts");
          }
          parent = await tx.chartAccount.findFirst({
            where: { id: parent.parentId },
            select: { id: true, parentId: true },
          });
        }
      }

      await tx.chartAccount.update({
        where: { id },
        data: {
          name,
          type: mapping.type,
          normalBalance: mapping.normalBalance,
          classification: input.classification,
          statementGroup,
          currency,
          branchId,
          parentId,
          description: input.description?.trim() || null,
          note: input.note?.trim() || null,
          vatApplicable: Boolean(input.vatApplicable),
          isBank: input.classification === "BANK",
        },
      });

      if (input.classification === "BANK") {
        if (account.bankAccount) {
          await tx.bankAccount.update({
            where: { id: account.bankAccount.id },
            data: { name, currency, isActive: true },
          });
        } else {
          await tx.bankAccount.create({
            data: {
              accountId: id,
              name,
              currency,
            },
          });
        }
      } else if (account.isBank && account.bankAccount) {
        await tx.bankAccount.update({
          where: { id: account.bankAccount.id },
          data: { isActive: false },
        });
      }
    });

    revalidateAccountingPaths();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not update account",
    };
  }
}

export async function updateAccountBranch(input: {
  accountId: string;
  branchId?: string | null;
}) {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const accountId = input.accountId.trim();
  if (!accountId) return { success: false, error: "Account is required" };

  try {
    await withTenantTransaction(user.organizationId, async (tx) => {
      const [account, branchId] = await Promise.all([
        tx.chartAccount.findFirst({
          where: { id: accountId, isActive: true },
          select: { id: true },
        }),
        resolveBranchId(tx, input.branchId),
      ]);

      if (!account) throw new Error("Account not found");

      await tx.chartAccount.update({
        where: { id: accountId },
        data: { branchId },
      });
    });

    revalidateAccountingPaths();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not update account branch",
    };
  }
}

export async function getAccountTree() {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const db = getTenantPrisma(user.organizationId);

  const [accounts, lines, branches] = await Promise.all([
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
        branchId: true,
        vatApplicable: true,
        parentId: true,
        description: true,
        note: true,
        isSystem: true,
        Branch: { select: { id: true, name: true, code: true } },
      },
    }),
    db.ledgerLine.findMany({
      where: { journalEntry: { status: "POSTED" } },
      select: {
        accountId: true,
        debit: true,
        credit: true,
      },
    }),
    db.branch.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  // Per-account totals (all branches)
  const totalsByAccount = new Map<string, { debit: number; credit: number }>();

  for (const line of lines) {
    const at = totalsByAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
    at.debit  += Number(line.debit);
    at.credit += Number(line.credit);
    totalsByAccount.set(line.accountId, at);
  }

  const byGroup = new Map<StatementGroup, any[]>();
  const branchTotals = new Map<
    string,
    { net: number; accountIds: Set<string> }
  >();

  for (const account of accounts) {
    const group = resolveGroup(account);
    const totals = totalsByAccount.get(account.id) ?? { debit: 0, credit: 0 };
    const balance = amountForStatementSide(
      account.type as AccountType,
      totals.debit,
      totals.credit,
    );

    const rows = byGroup.get(group) ?? [];
    const row = {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      classification: account.classification,
      statementGroup: account.statementGroup,
      classificationLabel: account.classification
        ? CLASSIFICATION_MAP[account.classification as Classification]?.label ??
          account.classification
        : account.type,
      currency: account.currency ?? "KES",
      branchId: account.branchId,
      branchName: account.Branch?.name ?? null,
      branchCode: account.Branch?.code ?? null,
      vatApplicable: account.vatApplicable,
      parentId: account.parentId,
      description: account.description,
      note: account.note,
      isSystem: account.isSystem,
      balance: Math.round(balance * 100) / 100,
    };

    if (row.branchId) {
      const branchTotal = branchTotals.get(row.branchId) ?? {
        net: 0,
        accountIds: new Set<string>(),
      };
      branchTotal.net += row.balance;
      branchTotal.accountIds.add(row.id);
      branchTotals.set(row.branchId, branchTotal);
    }

    rows.push(row);
    byGroup.set(group, rows);
  }

  const groups = STATEMENT_GROUPS.map((group) => {
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

  // Summarise assigned account balances by branch for the top overview.
  const branchSummary = branches.map((b) => {
    const bt = branchTotals.get(b.id) ?? { net: 0, accountIds: new Set() };
    return {
      id: b.id,
      name: b.name,
      code: b.code,
      net: Math.round(bt.net * 100) / 100,
      accountCount: bt.accountIds.size,
    };
  });

  return { groups, branchSummary, branches };
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
