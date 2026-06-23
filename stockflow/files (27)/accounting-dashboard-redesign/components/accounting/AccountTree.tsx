"use client";

import { useState } from "react";
import Link from "next/link";
import { AddAccountForm } from "./AddAccountForm";
import { ChevronRight, ChevronDown, Plus } from "lucide-react";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  classificationLabel: string;
  currency: string;
  vatApplicable: boolean;
  balance: number;
};
type Group = {
  key: string;
  label: string;
  statement: "BALANCE_SHEET" | "INCOME_STATEMENT";
  accounts: Account[];
  total: number;
};
type Parent = { id: string; code: string; name: string };

function money(n: number, currency = "KES") {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AccountTree({ groups, parents }: { groups: Group[]; parents: Parent[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const balanceSheet = groups.filter((g) => g.statement === "BALANCE_SHEET");
  const incomeStatement = groups.filter((g) => g.statement === "INCOME_STATEMENT");

  function renderGroup(g: Group) {
    const isOpen = expanded.has(g.key);
    const isAdding = adding === g.key;
    return (
      <div key={g.key} className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 8 }}>
        {/* Heading row */}
        <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 10 }}>
          <button
            type="button"
            onClick={() => toggle(g.key)}
            aria-label={isOpen ? "Collapse" : "Expand"}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center", padding: 0 }}
          >
            {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          <button
            type="button"
            onClick={() => toggle(g.key)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", fontWeight: 700, fontSize: 15, flex: 1, textAlign: "left" }}
          >
            {g.label}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
              {g.accounts.length} {g.accounts.length === 1 ? "account" : "accounts"}
            </span>
          </button>
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, marginRight: 8 }}>
            {money(g.total)}
          </span>
          <button
            type="button"
            onClick={() => { setAdding(isAdding ? null : g.key); if (!isOpen) toggle(g.key); }}
            className="btn btn-ghost btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
          >
            <Plus size={14} /> Add Account
          </button>
        </div>

        {/* Accounts under the heading */}
        {isOpen && (
          <div>
            {g.accounts.length === 0 && !isAdding && (
              <div style={{ padding: "10px 16px 14px 42px", color: "var(--muted)", fontSize: 13 }}>
                No accounts yet — use “Add Account”.
              </div>
            )}
            {g.accounts.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ fontSize: 11, color: "var(--muted)", textAlign: "left" }}>
                    <th style={{ padding: "6px 16px 6px 42px", fontWeight: 700 }}>NAME</th>
                    <th style={{ padding: "6px 16px", fontWeight: 700 }}>TYPE</th>
                    <th style={{ padding: "6px 16px", fontWeight: 700, textAlign: "right" }}>BALANCE</th>
                    <th style={{ padding: "6px 16px", fontWeight: 700, textAlign: "right" }}>REPORT</th>
                  </tr>
                </thead>
                <tbody>
                  {g.accounts.map((a) => (
                    <tr key={a.id} style={{ borderTop: "1px solid var(--border2)" }}>
                      <td style={{ padding: "8px 16px 8px 42px" }}>
                        <span style={{ fontFamily: "monospace", color: "var(--muted)", fontSize: 12, marginRight: 8 }}>{a.code}</span>
                        {a.name}
                        {a.vatApplicable && <span style={tag}>VAT</span>}
                      </td>
                      <td style={{ padding: "8px 16px", fontSize: 13, color: "var(--muted)" }}>{a.classificationLabel}</td>
                      <td style={{ padding: "8px 16px", textAlign: "right", fontFamily: "monospace" }}>
                        {a.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "8px 16px", textAlign: "right" }}>
                        <Link href={`/accounting/ledger?account=${a.id}`} className="btn btn-ghost btn-sm">Report</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {isAdding && (
              <AddAccountForm
                statementGroup={g.key}
                groupLabel={g.label}
                parents={parents}
                onDone={() => setAdding(null)}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <SectionLabel>Balance Sheet</SectionLabel>
      {balanceSheet.map(renderGroup)}
      <SectionLabel>Income Statement</SectionLabel>
      {incomeStatement.map(renderGroup)}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", margin: "18px 0 8px 2px" }}>
      {children}
    </div>
  );
}

const tag: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, marginLeft: 8,
  background: "rgba(46,84,150,0.15)", color: "#2E5496",
};
