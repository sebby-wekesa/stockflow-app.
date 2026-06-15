import Link from "next/link";
import { getTransactionFormData } from "@/actions/accounting-transactions";
import { TransactionsHub } from "@/components/accounting/TransactionsHub";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const data = await getTransactionFormData();

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Record Transactions</h1>
          <div className="section-sub">
            Post everyday financial activity |{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>
              Back to Accounting
            </Link>
          </div>
        </div>
      </div>

      {!data.seeded ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          Set up the chart of accounts from the Accounting page before recording
          transactions.
        </div>
      ) : (
        <TransactionsHub data={data} />
      )}
    </div>
  );
}
