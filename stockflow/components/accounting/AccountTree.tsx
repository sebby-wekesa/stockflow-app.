"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import {
  AddAccountForm,
  EditAccountForm,
} from "@/components/accounting/AddAccountForm";
import type {
  Classification,
  StatementGroup,
} from "@/lib/accounting/classifications";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  classification: Classification | null;
  statementGroup?: StatementGroup | null;
  classificationLabel: string;
  currency: string;
  vatApplicable: boolean;
  parentId?: string | null;
  description?: string | null;
  note?: string | null;
  isSystem: boolean;
  balance: number;
};

type AccountGroup = {
  key: StatementGroup;
  label: string;
  statement: "BALANCE_SHEET" | "INCOME_STATEMENT";
  accounts: Account[];
  total: number;
};

type ParentAccount = {
  id: string;
  code: string;
  name: string;
};

function money(amount: number, currency = "KES") {
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const signed = amount < 0 ? `(${formatted})` : formatted;
  return `${currency} ${signed}`;
}

export function AccountTree({
  groups,
  parents,
}: {
  groups: AccountGroup[];
  parents: ParentAccount[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  function toggle(key: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function openAddAccount(key: string) {
    setAdding((current) => (current === key ? null : key));
    setEditing(null);
    setExpanded((previous) => {
      const next = new Set(previous);
      next.add(key);
      return next;
    });
  }

  const balanceSheet = groups.filter(
    (group) => group.statement === "BALANCE_SHEET",
  );
  const incomeStatement = groups.filter(
    (group) => group.statement === "INCOME_STATEMENT",
  );

  function renderGroup(group: AccountGroup) {
    const isOpen = expanded.has(group.key);
    const isAdding = adding === group.key;

    return (
      <div
        key={group.key}
        className="card"
        style={{ padding: 0, overflow: "hidden", marginBottom: 8 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 14px",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => toggle(group.key)}
            aria-label={isOpen ? "Collapse account group" : "Expand account group"}
            style={iconButtonStyle}
          >
            {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          <button
            type="button"
            onClick={() => toggle(group.key)}
            style={headingButtonStyle}
          >
            {group.label}
            <span
              style={{
                color: "var(--muted)",
                fontWeight: 400,
                fontSize: 12,
                marginLeft: 8,
              }}
            >
              {group.accounts.length}{" "}
              {group.accounts.length === 1 ? "account" : "accounts"}
            </span>
          </button>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: 14,
              marginRight: 8,
              whiteSpace: "nowrap",
            }}
          >
            {money(group.total)}
          </span>
          <button
            type="button"
            onClick={() => openAddAccount(group.key)}
            className="btn btn-ghost btn-sm"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
            }}
          >
            <Plus size={14} /> Add Account
          </button>
        </div>

        {isOpen && (
          <div>
            {group.accounts.length === 0 && !isAdding && (
              <div
                style={{
                  padding: "10px 16px 14px 42px",
                  color: "var(--muted)",
                  fontSize: 13,
                }}
              >
                No accounts yet. Use Add Account.
              </div>
            )}

            {group.accounts.length > 0 && (
              <div className="table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        textAlign: "left",
                      }}
                    >
                      <th style={{ padding: "6px 16px 6px 42px" }}>Name</th>
                      <th style={{ padding: "6px 16px" }}>Type</th>
                      <th style={{ padding: "6px 16px", textAlign: "right" }}>
                        Balance
                      </th>
                      <th style={{ padding: "6px 16px", textAlign: "right" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.accounts.map((account) => (
                      <Fragment key={account.id}>
                        <tr style={{ borderTop: "1px solid var(--border2)" }}>
                          <td style={{ padding: "8px 16px 8px 42px" }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--muted)",
                                fontSize: 12,
                                marginRight: 8,
                              }}
                            >
                              {account.code}
                            </span>
                            {account.name}
                            {account.vatApplicable && <span style={tagStyle}>VAT</span>}
                          </td>
                          <td
                            style={{
                              padding: "8px 16px",
                              fontSize: 13,
                              color: "var(--muted)",
                            }}
                          >
                            {account.classificationLabel}
                          </td>
                          <td
                            style={{
                              padding: "8px 16px",
                              textAlign: "right",
                              fontFamily: "var(--font-mono)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {money(account.balance, account.currency)}
                          </td>
                          <td style={{ padding: "8px 16px" }}>
                            <div style={rowActionStyle}>
                              {!account.isSystem && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => {
                                    setAdding(null);
                                    setEditing((current) =>
                                      current === account.id ? null : account.id,
                                    );
                                  }}
                                  aria-label={`Edit ${account.name}`}
                                  style={rowActionButtonStyle}
                                >
                                  <Pencil size={14} /> Edit
                                </button>
                              )}
                              <Link
                                href={`/accounting/ledger?account=${account.id}`}
                                className="btn btn-ghost btn-sm"
                              >
                                Report
                              </Link>
                            </div>
                          </td>
                        </tr>
                        {editing === account.id && (
                          <tr style={{ borderTop: "1px solid var(--border2)" }}>
                            <td colSpan={4} style={{ padding: 0 }}>
                              <EditAccountForm
                                account={account}
                                groupLabel={group.label}
                                parents={parents}
                                onDone={() => setEditing(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isAdding && (
              <AddAccountForm
                statementGroup={group.key}
                groupLabel={group.label}
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
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "1px",
        color: "var(--muted)",
        margin: "18px 0 8px 2px",
      }}
    >
      {children}
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--muted)",
  display: "flex",
  alignItems: "center",
  padding: 0,
};

const headingButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text)",
  fontWeight: 700,
  fontSize: 15,
  flex: 1,
  textAlign: "left",
};

const tagStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "1px 6px",
  borderRadius: 4,
  marginLeft: 8,
  background: "rgba(46,84,150,0.15)",
  color: "var(--blue)",
};

const rowActionStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const rowActionButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};
