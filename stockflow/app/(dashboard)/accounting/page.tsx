import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { seedChartOfAccounts } from "@/actions/accounting";
import {
  getAccountTree,
  getParentAccountOptions,
} from "@/actions/accounting-tree";
import { AccountTree } from "@/components/accounting/AccountTree";

export const dynamic = "force-dynamic";

async function seedAction() {
  "use server";
  await seedChartOfAccounts();
}

export default async function AccountingPage() {
  await requireRole("ADMIN", "MANAGER", "ACCOUNTS");

  const [{ groups, branchSummary, branches }, parents] = await Promise.all([
    getAccountTree(),
    getParentAccountOptions(),
  ]);

  const tools = [
    { href: "/accounting/transactions", label: "Record Transactions" },
    { href: "/accounting/insights", label: "Insights" },
    { href: "/accounting/profit-loss", label: "Income Statement" },
    { href: "/accounting/balance-sheet", label: "Balance Sheet" },
    { href: "/accounting/trial-balance", label: "Trial Balance" },
    { href: "/accounting/ledger", label: "General Ledger" },
    { href: "/accounting/debtors", label: "Debtors" },
    { href: "/accounting/creditors", label: "Creditors" },
    { href: "/accounting/banking", label: "Banking" },
    { href: "/accounting/chart", label: "Chart of Accounts" },
    { href: "/accounting/journal", label: "Journal Entry" },
  ];

  const hasAccounts = groups.some((group) => group.accounts.length > 0);

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Accounting</h1>
          <div className="section-sub">
            Expand a statement heading to see accounts, balances, and reports.
          </div>
        </div>
        {!hasAccounts && (
          <form action={seedAction}>
            <button type="submit" className="btn btn-ghost btn-sm">
              Load standard accounts
            </button>
          </form>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12 }}
          >
            {tool.label}
          </Link>
        ))}
      </div>

      {!hasAccounts && (
        <div className="card" style={{ padding: 20, marginBottom: 16, borderLeft: "3px solid #C55A11" }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>No accounts yet</p>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Load the standard Kenyan SME chart, or expand any heading and use{" "}
            <strong>Add Account</strong> to build your own structure.
          </p>
        </div>
      )}

      <AccountTree
        groups={groups}
        branches={branches}
        branchSummary={branchSummary}
        parents={parents}
      />
    </div>
  );
}
