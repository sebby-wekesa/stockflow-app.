"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import { updateAccountBranch as saveAccountBranch } from "@/actions/accounting-tree";
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
  branchId?: string | null;
  branchName?: string | null;
  branchCode?: string | null;
};

type AccountGroup = {
  key: StatementGroup;
  label: string;
  statement: "BALANCE_SHEET" | "INCOME_STATEMENT";
  accounts: Account[];
  total: number;
};

type BranchOption = {
  id: string;
  name: string;
  code: string;
};

type BranchSummary = {
  id: string;
  name: string;
  code: string;
  net: number;
  accountCount: number;
};

type ParentAccount = {
  id: string;
  code: string;
  name: string;
};

type BranchAccountGroup = {
  id: string | null;
  name: string;
  code: string | null;
  accounts: Account[];
  total: number;
};

function money(amount: number, currency = "KES") {
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const signed = amount < 0 ? `(${formatted})` : formatted;
  return `${currency} ${signed}`;
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

// A palette of colours to cycle through for branch cards
const BRANCH_COLORS = [
  { color: "#2563eb", dim: "rgba(37,99,235,0.10)" },
  { color: "#16a34a", dim: "rgba(22,163,74,0.10)" },
  { color: "#d97706", dim: "rgba(217,119,6,0.10)" },
  { color: "#7c3aed", dim: "rgba(124,58,237,0.10)" },
  { color: "#db2777", dim: "rgba(219,39,119,0.10)" },
  { color: "#0891b2", dim: "rgba(8,145,178,0.10)" },
];

export function AccountTree({
  groups,
  branches,
  branchSummary,
  parents,
}: {
  groups: AccountGroup[];
  branches: BranchOption[];
  branchSummary: BranchSummary[];
  parents: ParentAccount[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [branchOverrides, setBranchOverrides] = useState<
    Record<string, string | null>
  >({});
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [savingBranchAccountId, setSavingBranchAccountId] = useState<
    string | null
  >(null);
  const [, startBranchTransition] = useTransition();
  const [branchError, setBranchError] = useState<string | null>(null);

  const branchById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch])),
    [branches],
  );

  const accountGroups = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        accounts: group.accounts.map((account) => {
          if (!Object.prototype.hasOwnProperty.call(branchOverrides, account.id)) {
            return account;
          }

          const branchId = branchOverrides[account.id];
          const branch = branchId ? branchById.get(branchId) : null;
          return {
            ...account,
            branchId,
            branchName: branch?.name ?? null,
            branchCode: branch?.code ?? null,
          };
        }),
      })),
    [branchById, branchOverrides, groups],
  );

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

  function changeAccountBranch(account: Account, branchId: string | null) {
    const previousBranchId = account.branchId ?? null;
    if (previousBranchId === branchId) return;

    setBranchError(null);
    setSavingBranchAccountId(account.id);
    setBranchOverrides((previous) => ({ ...previous, [account.id]: branchId }));

    startBranchTransition(async () => {
      const result = await saveAccountBranch({
        accountId: account.id,
        branchId,
      });

      if (!result.success) {
        setBranchOverrides((previous) => ({
          ...previous,
          [account.id]: previousBranchId,
        }));
        setBranchError(result.error || "Could not update account branch");
      } else {
        router.refresh();
      }

      setSavingBranchAccountId(null);
    });
  }

  const balanceSheet = accountGroups.filter(
    (group) => group.statement === "BALANCE_SHEET",
  );
  const incomeStatement = accountGroups.filter(
    (group) => group.statement === "INCOME_STATEMENT",
  );

  const visibleBranchSummary = branchSummary.filter(
    (branch) => branch.accountCount > 0,
  );

  function renderGroup(group: AccountGroup) {
    const isOpen = expanded.has(group.key);
    const isAdding = adding === group.key;
    const branchGroups = groupAccountsByBranch(group.accounts, branches);
    const categoryTotal = roundMoney(
      branchGroups.reduce((sum, branchGroup) => sum + branchGroup.total, 0),
    );

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
            {money(categoryTotal)}
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

            {branchGroups.map((branchGroup) => (
              <div key={branchGroup.id ?? "unassigned"} style={branchSectionStyle}>
                <div style={branchHeadingStyle}>
                  <div style={branchHeadingCopyStyle}>
                    <span style={branchMarkerStyle} />
                    <span>{branchGroup.name}</span>
                    {branchGroup.code && (
                      <span style={branchCodeStyle}>[{branchGroup.code}]</span>
                    )}
                    <span style={branchCountStyle}>
                      {branchGroup.accounts.length}{" "}
                      {branchGroup.accounts.length === 1 ? "account" : "accounts"}
                    </span>
                  </div>
                </div>
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
                        <th style={{ padding: "6px 16px" }}>Branch</th>
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
                      {branchGroup.accounts.map((account) => (
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
                              {account.vatApplicable && (
                                <span style={tagStyle}>VAT</span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "8px 16px",
                                minWidth: 180,
                              }}
                            >
                              <select
                                value={account.branchId ?? ""}
                                onChange={(event) =>
                                  changeAccountBranch(
                                    account,
                                    event.target.value || null,
                                  )
                                }
                                disabled={savingBranchAccountId === account.id}
                                aria-label={`Branch for ${account.name}`}
                                style={branchSelectStyle}
                              >
                                <option value="">Unassigned</option>
                                {branches.map((branch) => (
                                  <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td
                              style={{
                                padding: "8px 16px",
                                fontSize: 13,
                                color: "var(--muted)",
                              }}
                            >
                              {account.type.charAt(0) +
                                account.type.slice(1).toLowerCase()}
                            </td>
                            <td
                              style={{
                                padding: "8px 16px",
                                textAlign: "right",
                                fontFamily: "var(--font-mono)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {money(account.balance)}
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
                              <td colSpan={5} style={{ padding: 0 }}>
                                <EditAccountForm
                                  account={account}
                                  groupLabel={group.label}
                                  branches={branches}
                                  parents={parents}
                                  onDone={() => setEditing(null)}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={branchTotalLabelStyle}>
                          {branchGroup.name} Total
                        </td>
                        <td style={branchTotalAmountStyle}>
                          {money(branchGroup.total)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}

            {branchGroups.length > 0 && (
              <div style={categoryTotalRowStyle}>
                <span>Total {group.label}</span>
                <span style={categoryTotalAmountStyle}>
                  {money(categoryTotal)}
                </span>
              </div>
            )}

            {isAdding && (
              <AddAccountForm
                statementGroup={group.key}
                groupLabel={group.label}
                branches={branches}
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
      {/* Branch summary cards */}
      {visibleBranchSummary.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {visibleBranchSummary.map((branch, i) => {
            const { color, dim } = BRANCH_COLORS[i % BRANCH_COLORS.length];
            return (
              <div
                key={branch.id}
                className="card"
                style={{
                  padding: "14px 16px",
                  borderLeft: `3px solid ${color}`,
                  background: dim,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color,
                    marginBottom: 6,
                  }}
                >
                  {branch.name}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 400,
                      marginLeft: 6,
                      opacity: 0.7,
                      fontSize: 10,
                    }}
                  >
                    [{branch.code}]
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    fontSize: 17,
                    color: "var(--text)",
                    marginBottom: 3,
                  }}
                >
                  {money(branch.net)}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {branch.accountCount} {branch.accountCount === 1 ? "account" : "accounts"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {branchError && (
        <div
          role="alert"
          className="card"
          style={{
            padding: 12,
            marginBottom: 14,
            borderLeft: "3px solid var(--red)",
            color: "var(--red)",
          }}
        >
          {branchError}
        </div>
      )}

      <SectionLabel>Balance Sheet</SectionLabel>
      {balanceSheet.map(renderGroup)}
      <SectionLabel>Income Statement</SectionLabel>
      {incomeStatement.map(renderGroup)}
    </div>
  );
}

function groupAccountsByBranch(
  accounts: Account[],
  branches: BranchOption[],
): BranchAccountGroup[] {
  const groupsByBranch = new Map<string, BranchAccountGroup>();
  const unknownGroups: BranchAccountGroup[] = [];
  const unassigned: BranchAccountGroup = {
    id: null,
    name: "Unassigned",
    code: null,
    accounts: [],
    total: 0,
  };

  for (const branch of branches) {
    groupsByBranch.set(branch.id, {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      accounts: [],
      total: 0,
    });
  }

  for (const account of accounts) {
    let branchGroup = account.branchId
      ? groupsByBranch.get(account.branchId)
      : null;

    if (account.branchId && !branchGroup) {
      branchGroup = {
        id: account.branchId,
        name: account.branchName ?? "Unknown branch",
        code: account.branchCode ?? null,
        accounts: [],
        total: 0,
      };
      groupsByBranch.set(account.branchId, branchGroup);
      unknownGroups.push(branchGroup);
    }

    const target = branchGroup ?? unassigned;
    target.accounts.push(account);
    target.total = roundMoney(target.total + account.balance);
  }

  return [
    ...branches
      .map((branch) => groupsByBranch.get(branch.id))
      .filter(
        (branchGroup): branchGroup is BranchAccountGroup =>
          Boolean(branchGroup && branchGroup.accounts.length > 0),
      ),
    ...unknownGroups.filter((branchGroup) => branchGroup.accounts.length > 0),
    ...(unassigned.accounts.length > 0 ? [unassigned] : []),
  ];
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

const branchSectionStyle: React.CSSProperties = {
  borderTop: "1px solid var(--border2)",
  background: "color-mix(in srgb, var(--surface2) 24%, transparent)",
};

const branchHeadingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 16px 8px 42px",
};

const branchHeadingCopyStyle: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  fontWeight: 800,
};

const branchMarkerStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "var(--accent)",
  flexShrink: 0,
};

const branchCodeStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--muted)",
  fontWeight: 500,
};

const branchCountStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  fontWeight: 600,
};

const branchSelectStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 150,
  padding: "7px 9px",
  background: "var(--surface)",
  border: "1px solid var(--border2)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  fontSize: 12,
};

const branchTotalLabelStyle: React.CSSProperties = {
  padding: "9px 16px 10px 42px",
  fontWeight: 800,
  borderTop: "1px solid var(--border2)",
  color: "var(--text)",
};

const branchTotalAmountStyle: React.CSSProperties = {
  padding: "9px 16px 10px",
  textAlign: "right",
  fontFamily: "var(--font-mono)",
  fontWeight: 800,
  borderTop: "1px solid var(--border2)",
  whiteSpace: "nowrap",
};

const categoryTotalRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 16px 12px 42px",
  borderTop: "2px solid var(--border2)",
  background: "rgba(240,192,64,0.08)",
  color: "var(--text)",
  fontWeight: 900,
};

const categoryTotalAmountStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  whiteSpace: "nowrap",
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
