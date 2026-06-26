import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listAccounts } from "@/actions/accounting";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { JournalForm } from "@/components/accounting/JournalForm";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const user = await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const db = getTenantPrisma(user.organizationId);
  const [accounts, branches] = await Promise.all([
    listAccounts(),
    db.branch.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);
  const defaultBranchId =
    branches.find((branch) => branch.id === user.branches[0]?.id)?.id ??
    branches[0]?.id ??
    "";

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Manual Journal Entry</h1>
          <div className="section-sub">
            Post a balanced entry ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
      </div>
      {accounts.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          Seed the chart of accounts first.
        </div>
      ) : (
        <JournalForm
          accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))}
          branches={branches}
          defaultBranchId={defaultBranchId}
        />
      )}
    </div>
  );
}
