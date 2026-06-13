import type { CSSProperties } from "react";
import Link from "next/link";
import { getBalanceSheet } from "@/actions/accounting-reports";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ReportRow = {
  code: string;
  name: string;
  amount: number;
};

function money(value: number) {
  const formatted = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `(${formatted})` : formatted;
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const params = await searchParams;
  const report = await getBalanceSheet({ asOf: params.asOf });

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Balance Sheet</h1>
          <div className="section-sub">
            As at {report.asOf} ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>
              ← Accounting
            </Link>
          </div>
        </div>
        <form
          method="get"
          style={{ display: "flex", gap: 8, alignItems: "end" }}
        >
          <input
            type="date"
            name="asOf"
            defaultValue={params.asOf ?? ""}
            style={inputStyle}
          />
          <button type="submit" className="btn btn-ghost btn-sm">
            Apply
          </button>
        </form>
      </div>

      {!report.balanced && (
        <div
          className="card"
          style={{
            padding: 12,
            marginBottom: 14,
            borderLeft: "3px solid #b91c1c",
            color: "#b91c1c",
          }}
        >
          Assets do not equal Liabilities + Equity. Review the posted journals.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <Block
          title="Assets"
          rows={report.assets}
          total={report.totalAssets}
          totalLabel="Total Assets"
        />
        <div style={{ display: "grid", gap: 16 }}>
          <Block
            title="Liabilities"
            rows={report.liabilities}
            total={report.totalLiabilities}
            totalLabel="Total Liabilities"
          />
          <Block
            title="Equity"
            rows={report.equity}
            total={report.totalEquity}
            totalLabel="Total Equity"
          />
          <div
            className="card"
            style={{
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontWeight: 800,
              background: "rgba(46,84,150,0.06)",
            }}
          >
            <span>Liabilities + Equity</span>
            <span style={{ fontFamily: "monospace" }}>
              {money(report.totalLiabilitiesAndEquity)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({
  title,
  rows,
  total,
  totalLabel,
}: {
  title: string;
  rows: ReportRow[];
  total: number;
  totalLabel: string;
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          padding: "10px 16px",
          background: "var(--surface2)",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--muted)",
        }}
      >
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "8px 16px", color: "var(--muted)", fontSize: 13 }}>
          None
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={`${row.code}-${row.name}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "7px 16px",
              borderBottom: "1px solid var(--border2)",
            }}
          >
            <span>
              <span
                style={{
                  fontFamily: "monospace",
                  color: "var(--muted)",
                  fontSize: 12,
                  marginRight: 8,
                }}
              >
                {row.code}
              </span>
              {row.name}
            </span>
            <span style={{ fontFamily: "monospace" }}>{money(row.amount)}</span>
          </div>
        ))
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 16px",
          fontWeight: 700,
          borderTop: "2px solid var(--border2)",
        }}
      >
        <span>{totalLabel}</span>
        <span style={{ fontFamily: "monospace" }}>{money(total)}</span>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  padding: "8px 10px",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  fontSize: 14,
};
