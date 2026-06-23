"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import {
  CLASSIFICATION_MAP,
  STATEMENT_GROUPS,
  type Classification,
  type StatementGroup,
} from "@/lib/accounting/classifications";

// ── Create an account the way TJ's form does ─────────────────────────────────
// The clerk supplies a name, currency, classification, optional parent,
// description, note and VAT flag. We DERIVE the base type, normal balance and
// statement group from the classification, and AUTO-GENERATE the code (TJ's
// form has no code field — clerks shouldn't have to think about numbering).
export async function createClassifiedAccount(input: {
  name: string;
  currency?: string;
  classification: Classification;
  // The heading the "Add Account" was opened under. Lets Finance Charges (which
  // no classification maps to directly) still receive accounts; otherwise we
  // fall back to the classification's default group.
  statementGroup?: StatementGroup | null;
  parentId?: string | null;
  description?: string | null;
  note?: string | null;
  vatApplicable?: boolean;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const name = (input.name ?? "").trim();
  if (!name) return { success: false, error: "Account name is required" };

  const mapping = CLASSIFICATION_MAP[input.classification];
  if (!mapping) return { success: false, error: "Pick a valid classification" };

  const group = (input.statementGroup as StatementGroup) || mapping.group;

  // Auto-generate a unique code from the base type's number band.
  const band: Record<string, number> = {
    ASSET: 1000,
    LIABILITY: 2000,
    EQUITY: 3000,
    INCOME: 4000,
    EXPENSE: 5000,
  };
  const base = band[mapping.type] ?? 9000;
  const existing = await db.chartAccount.findMany({
    where: { type: mapping.type },
    select: { code: true },
  });
  let maxN = base;
  for (const a of existing as any[]) {
    const n = parseInt(a.code, 10);
    if (!isNaN(n) && n >= base && n < base + 1000 && n > maxN) maxN = n;
  }
  let code = String(maxN + 10);
  // guard against collision
  for (let i = 0; i < 200; i++) {
    const clash = await db.chartAccount.findFirst({ where: { code } });
    if (!clash) break;
    code = String(parseInt(code, 10) + 1);
  }

  // Validate parent if supplied.
  if (input.parentId) {
    const parent = await db.chartAccount.findFirst({ where: { id: input.parentId } });
    if (!parent) return { success: false, error: "Selected parent account not found" };
  }

  const account = await db.chartAccount.create({
    data: {
      organizationId: user.organizationId,
      code,
      name,
      type: mapping.type as any,
      normalBalance: mapping.normalBalance as any,
      classification: input.classification as any,
      statementGroup: group as any,
      currency: input.currency?.trim() || "KES",
      parentId: input.parentId || null,
      description: input.description?.trim() || null,
      note: input.note?.trim() || null,
      vatApplicable: Boolean(input.vatApplicable),
      isBank: input.classification === "BANK",
    },
  });

  revalidatePath("/accounting");
  return { success: true, accountId: account.id, code };
}

// ── The dashboard tree: 11 headings, each with its accounts + live balances ──
export async function getAccountTree() {
  const user = await requireRole("ADMIN", "MANAGER", "SALES");
  const db = getTenantPrisma(user.organizationId);

  const accounts = await db.chartAccount.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  // Net ledger movement per account (posted only), for the live balance.
  const lines = await db.ledgerLine.findMany({
    where: { journalEntry: { status: "POSTED" } },
    select: { accountId: true, debit: true, credit: true },
  });
  const net = new Map<string, number>();
  for (const l of lines as any[]) {
    net.set(l.accountId, (net.get(l.accountId) ?? 0) + Number(l.debit) - Number(l.credit));
  }

  // Resolve each account's group: explicit statementGroup, else derive from
  // classification, else fall back by type+code (legacy/seeded accounts).
  function groupOf(a: any): StatementGroup {
    if (a.statementGroup) return a.statementGroup;
    if (a.classification && CLASSIFICATION_MAP[a.classification as Classification])
      return CLASSIFICATION_MAP[a.classification as Classification].group;
    const code = a.code || "";
    switch (a.type) {
      case "ASSET":
        return code.startsWith("15") ? "NON_CURRENT_ASSETS" : "CURRENT_ASSETS";
      case "LIABILITY":
        return code.startsWith("23") ? "NON_CURRENT_LIABILITIES" : "CURRENT_LIABILITIES";
      case "EQUITY":
        return "EQUITY";
      case "INCOME":
        return code === "4000" ? "REVENUE" : "OTHER_INCOME";
      case "EXPENSE":
        if (code === "5000") return "COST_OF_GOODS_SOLD";
        if (code === "5400") return "FINANCE_CHARGES";
        return "ADMINISTRATIVE_EXPENSES";
      default:
        return "CURRENT_ASSETS";
    }
  }

  const byGroup = new Map<string, any[]>();
  for (const a of accounts as any[]) {
    const g = groupOf(a);
    const bal = net.get(a.id) ?? 0;
    // Present balance on the account's normal side as a positive figure.
    const displayBalance = a.normalBalance === "DEBIT" ? bal : -bal;
    (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      classification: a.classification,
      classificationLabel: a.classification
        ? CLASSIFICATION_MAP[a.classification as Classification]?.label ?? a.classification
        : a.type,
      currency: a.currency ?? "KES",
      vatApplicable: a.vatApplicable,
      parentId: a.parentId,
      balance: Math.round(displayBalance * 100) / 100,
    });
  }

  // Emit all 11 groups in order (even empty ones, so headings always show).
  return STATEMENT_GROUPS.map((g) => {
    const rows = byGroup.get(g.key) ?? [];
    const total = rows.reduce((s, r) => s + r.balance, 0);
    return {
      key: g.key,
      label: g.label,
      statement: g.statement,
      accounts: rows,
      total: Math.round(total * 100) / 100,
    };
  });
}

// Accounts that can be parents (for the sub-account picker in the form).
export async function getParentAccountOptions() {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);
  const accounts = await db.chartAccount.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  return (accounts as any[]).map((a) => ({ id: a.id, code: a.code, name: a.name }));
}
