import type { CSSProperties } from "react";
import Link from "next/link";
import { getFinancialInsights } from "@/actions/accounting-reports";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const riskColor: Record<string, string> = {
  HIGH: "#b91c1c",
  MEDIUM: "#C55A11",
  LOW: "#2E7D32",
};

function money(value: number) {
  return (
    "KES " +
    value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const params = await searchParams;
  const insights = await getFinancialInsights({
    from: params.from,
    to: params.to,
  });
  const report = insights.profitAndLoss;

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Financial Insights</h1>
          <div className="section-sub">
            Posted ledger and confirmed sales ·{" "}
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
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <Kpi label="Revenue" value={money(report.totalIncome)} accent="#2E5496" />
        <Kpi
          label="Gross profit"
          value={money(report.grossProfit)}
          sub={`${report.grossMargin}% margin`}
          accent="#2E7D32"
        />
        <Kpi
          label={report.netProfit >= 0 ? "Net profit" : "Net loss"}
          value={money(report.netProfit)}
          sub={`${report.netMargin}% margin`}
          accent={report.netProfit >= 0 ? "#2E7D32" : "#b91c1c"}
        />
        <Kpi
          label="Customers"
          value={String(insights.customerCount)}
          accent="#555"
        />
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div style={{ fontWeight: 700 }}>Customer concentration</div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: 6,
              background: `${riskColor[insights.concentrationRisk]}22`,
              color: riskColor[insights.concentrationRisk],
            }}
          >
            {insights.concentrationRisk} RISK
          </span>
        </div>

        {insights.topCustomer && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            Your largest customer,{" "}
            <strong style={{ color: "var(--text)" }}>
              {insights.topCustomer.name}
            </strong>
            , represents{" "}
            <strong style={{ color: riskColor[insights.concentrationRisk] }}>
              {insights.topCustomer.share}%
            </strong>{" "}
            of confirmed sales in this period.
            {insights.concentrationRisk === "HIGH" &&
              " Losing them would put serious strain on the business."}
            {insights.concentrationRisk === "MEDIUM" &&
              " A meaningful share of revenue depends on one customer."}
            {insights.concentrationRisk === "LOW" &&
              " Revenue is well spread across customers."}
          </p>
        )}

        {insights.concentration.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            No confirmed sales in this period.
          </div>
        ) : (
          <div>
            {insights.concentration.map((customer) => (
              <div key={customer.key} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 13,
                    marginBottom: 2,
                  }}
                >
                  <span>{customer.name}</span>
                  <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>
                    {money(customer.amount)} · {customer.share}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "var(--surface2)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(customer.share, 100)}%`,
                      height: "100%",
                      background:
                        customer.share >= 50
                          ? "#b91c1c"
                          : customer.share >= 30
                            ? "#C55A11"
                            : "#2E5496",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        Profit figures come from posted journals. Customer concentration uses
        confirmed, ready-for-dispatch, and shipped sales. Open{" "}
        <Link href="/accounting/profit-loss" style={{ color: "var(--accent)" }}>
          Profit &amp; Loss
        </Link>{" "}
        for the full breakdown.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--muted)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, color: accent }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          {sub}
        </div>
      )}
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
