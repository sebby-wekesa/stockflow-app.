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

export default async function ChartOfAccountsPage() {
  await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const [{ groups, branchSummary, branches }, parents] = await Promise.all([
    getAccountTree(),
    getParentAccountOptions(),
  ]);

  const hasAccounts = groups.some((group) => group.accounts.length > 0);

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Chart of Accounts</h1>
          <div className="section-sub">
            Your account list ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
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

      {!hasAccounts ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          No accounts yet. Go back to Accounting and click “Set up chart of accounts”.
        </div>
      ) : (
        <AccountTree
          groups={groups}
          branches={branches}
          branchSummary={branchSummary}
          parents={parents}
        />
      )}
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        System accounts are used by automatic posting — you can rename them, but don’t delete them.
      </p>
    </div>
  );
}
