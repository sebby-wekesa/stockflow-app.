import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { seedChartOfAccounts } from "@/actions/accounting";
import { getAccountTree, getParentAccountOptions } from "@/actions/accounting-tree";
import { AccountTree } from "@/components/accounting/AccountTree";

export const dynamic = "force-dynamic";

async function seedAction() {
  "use server";
  await seedChartOfAccounts();
}

// Tools that live alongside the account structure — kept reachable so nothing
// is orphaned by the redesign.
const TOOLS = [
  { href: "/accounting/transactions", label: "Record Transactions" },
  { href: "/accounting/insights", label: "Insights" },
  { href: "/accounting/profit-loss", label: "Income Statement" },
  { href: "/accounting/balance-sheet", label: "Balance Sheet" },
  { href: "/accounting/trial-balance", label: "Trial Balance" },
  { href: "/accounting/ledger", label: "General Ledger" },
  { href: "/accounting/debtors", label: "Debtors" },
  { href: "/accounting/creditors", label: "Creditors" },
  { href: "/accounting/banking", label: "Banking" },
  { href: "/accounting/journal", label: "Journal Entry" },
];

export default async function AccountingPage() {
  await requireRole("ADMIN", "MANAGER");

  const [groups, parents] = await Promise.all([
    getAccountTree().catch(() => []),
    getParentAccountOptions().catch(() => []),
  ]);

  const hasAccounts = groups.some((g) => g.accounts.length > 0);

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Accounting</h1>
          <div className="section-sub">
            Your account structure — expand a heading to see its accounts, or add new ones.
            Balances update from every posting.
          </div>
        </div>
        {!hasAccounts && (
          <form action={seedAction}>
            <button type="submit" className="btn btn-ghost btn-sm">Load standard accounts</button>
          </form>
        )}
      </div>

      {/* Tools bar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
            {t.label}
          </Link>
        ))}
      </div>

      {!hasAccounts && (
        <div className="card" style={{ padding: 18, marginBottom: 16, borderLeft: "3px solid #C55A11" }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>No accounts yet</p>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Click <strong>Load standard accounts</strong> to start from a ready-made chart, or just
            expand any heading below and use <strong>Add Account</strong> to build your own.
          </p>
        </div>
      )}

      <AccountTree groups={groups} parents={parents} />
    </div>
  );
}
