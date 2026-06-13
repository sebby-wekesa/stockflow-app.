import type { CSSProperties } from "react";
import Link from "next/link";
import { getProfitAndLoss } from "@/actions/accounting-reports";
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

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const params = await searchParams;
  const report = await getProfitAndLoss({
    from: params.from,
    to: params.to,
  });

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Profit &amp; Loss</h1>
          <div className="section-sub">
            {report.from
              ? `${report.from} to ${report.to}`
              : `Up to ${report.to}`}{" "}
            ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>
              ← Accounting
            </Link>
          </div>
        </div>
      </div>

      <form
        method="get"
        className="card"
        style={{
          padding: 12,
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div>
          <label style={labelStyle}>FROM</label>
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>TO</label>
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            style={inputStyle}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-sm">
          Apply
        </button>
      </form>

      <div
        className="card"
        style={{ padding: 0, overflow: "hidden", maxWidth: 680 }}
      >
        <Section title="Income" rows={report.income} />
        <TotalRow label="Total Income" value={report.totalIncome} strong />
        <TotalRow label="Cost of Sales" value={-report.costOfSales} />
        <TotalRow
          label="Gross Profit"
          value={report.grossProfit}
          strong
          accent
        />
        <Section title="Operating Expenses" rows={report.expenses} />
        <TotalRow
          label="Total Operating Expenses"
          value={-report.totalOperatingExpenses}
          strong
        />

        <div
          style={{
            borderTop: "2px solid var(--border2)",
            padding: "14px 16px",
            display: "flex",
            justifyContent: "space-between",
            background:
              report.netProfit >= 0
                ? "rgba(46,125,50,0.08)"
                : "rgba(185,28,28,0.08)",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 16 }}>
            NET {report.netProfit >= 0 ? "PROFIT" : "LOSS"}
          </span>
          <span
            style={{
              fontWeight: 800,
              fontSize: 16,
              fontFamily: "monospace",
              color: report.netProfit >= 0 ? "#2E7D32" : "#b91c1c",
            }}
          >
            {money(report.netProfit)}
          </span>
        </div>
      </div>

      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16 }}
      >
        <Metric label="Gross margin" value={`${report.grossMargin}%`} />
        <Metric
          label="Net margin"
          value={`${report.netMargin}%`}
          accent={report.netMargin >= 0 ? "#2E7D32" : "#b91c1c"}
        />
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <>
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
            key={row.code}
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
    </>
  );
}

function TotalRow({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: number;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "9px 16px",
        borderBottom: "1px solid var(--border2)",
        fontWeight: strong ? 700 : 400,
        background: accent ? "rgba(46,84,150,0.06)" : undefined,
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: "monospace" }}>{money(value)}</span>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="card" style={{ padding: 14, minWidth: 140 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted)",
  display: "block",
  marginBottom: 4,
};

const inputStyle: CSSProperties = {
  padding: "8px 10px",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  fontSize: 14,
};
