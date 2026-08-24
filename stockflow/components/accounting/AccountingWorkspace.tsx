"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Ban,
  BookOpen,
  CheckCircle,
  Eye,
  FileText,
  Landmark,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Search,
  Wallet,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
  useTransition,
} from "react";
import { seedChartOfAccounts } from "@/actions/accounting";
import { PayrollPanel } from "@/components/accounting/PayrollPanel";
import {
  createCashBookAccount,
  deactivateCashBookAccount,
  postCashBookJournal,
  postCashBookTransaction,
  updateCashBookAccount,
  type AccountOption,
  type AccountingWorkspaceData,
  type AgeingRow,
  type CashBookAccountRow,
  type CashBookGroup,
  type CashBookGroupKey,
  type EmployeePostingKind,
  type RecentAccountingTransaction,
  type SourceType,
} from "@/actions/accounting-workspace";
import {
  maskAccountingAccountNumber,
  resolveClassifiedSource,
} from "@/lib/accounting/workspace";
import styles from "./AccountingWorkspace.module.css";

type PrimaryView = "overview" | "workspace" | "recent" | "ledgers" | "reports";
type PostTab = "cash-book" | "revenue" | "purchases" | "payroll";
type RecentTab =
  | "All"
  | "Administrative Expenses"
  | "Operating Expenses"
  | "Finance Charges"
  | "Payroll";
type TransactionMode = "deposit" | "cheque" | "journal" | "reconcile";

type ModalState =
  | { kind: "add"; group: CashBookGroupKey }
  | { kind: "edit"; account: CashBookAccountRow }
  | { kind: "deactivate"; account: CashBookAccountRow }
  | { kind: "transaction"; mode: TransactionMode; account?: CashBookAccountRow }
  | { kind: "transactions"; account: CashBookAccountRow }
  | { kind: "ledger"; title: string; row: AgeingRow }
  | null;

type ActionResult = {
  success: boolean;
  error?: string;
  entryNumber?: string;
  paymentNumber?: string;
  bankAccountId?: string;
};

const POST_TABS: { key: PostTab; label: string }[] = [
  { key: "cash-book", label: "Cash Book" },
  { key: "revenue", label: "Revenue" },
  { key: "purchases", label: "Purchases" },
  { key: "payroll", label: "Payroll" },
];

const RECENT_TABS: RecentTab[] = [
  "All",
  "Administrative Expenses",
  "Operating Expenses",
  "Finance Charges",
  "Payroll",
];

const CASH_TYPES = [
  "Petty Cash",
  "Cash Drawer",
  "M-Pesa",
  "Till",
  "Mobile Wallet",
  "Other Cash Equivalent",
];

const REPORT_LINKS = [
  {
    href: "/accounting/insights",
    title: "Financial insights",
    description: "Management ratios and movement checks.",
  },
  {
    href: "/accounting/profit-loss",
    title: "Profit and loss",
    description: "Income statement from posted journals.",
  },
  {
    href: "/accounting/balance-sheet",
    title: "Balance sheet",
    description: "Statement of financial position.",
  },
  {
    href: "/accounting/trial-balance",
    title: "Trial balance",
    description: "Debit and credit control report.",
  },
  {
    href: "/accounting/ledger",
    title: "General ledger",
    description: "Detailed account movements.",
  },
  {
    href: "/accounting/transactions",
    title: "Transaction history",
    description: "Recorded accounting transactions.",
  },
  {
    href: "/accounting/debtors",
    title: "Accounts receivable ageing",
    description: "Outstanding customer balances.",
  },
  {
    href: "/accounting/creditors",
    title: "Accounts payable ageing",
    description: "Outstanding supplier balances.",
  },
];

function money(value: number, currency = "KES") {
  return `${currency} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function groupedMoney(
  balances: AccountingWorkspaceData["cashBook"]["bank"]["balances"],
) {
  if (balances.length === 0) return money(0);
  return balances
    .map((balance) => money(balance.amount, balance.currency))
    .join(" · ");
}

function maskAccountNumber(value?: string | null) {
  return maskAccountingAccountNumber(value);
}

function accountDetails(account: CashBookAccountRow) {
  const masked = maskAccountNumber(account.accountNumber);
  if (account.group === "BANK") {
    return [account.bankName, masked].filter(Boolean).join(" · ") || "-";
  }
  return [account.bankName, masked].filter(Boolean).join(" · ") || "Cash equivalent";
}

function plainMoney(value: number) {
  return value === 0
    ? "-"
    : value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sourceTypeLabel(type: SourceType | null) {
  return type ?? "Unclassified";
}

function formatKsh(value: number) {
  return `Ksh ${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function AccountingWorkspace({
  data,
  initialView = "workspace",
  initialPostTab = "cash-book",
}: {
  data: AccountingWorkspaceData;
  initialView?: PrimaryView;
  initialPostTab?: PostTab;
}) {
  const router = useRouter();
  const [primaryView, setPrimaryView] = useState<PrimaryView>(initialView);
  const [postTab, setPostTab] = useState<PostTab>(initialPostTab);
  const [recentTab, setRecentTab] = useState<RecentTab>("All");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const showWorkspaceChrome =
    primaryView !== "overview" &&
    !(primaryView === "workspace" && (postTab === "revenue" || postTab === "purchases"));

  const filteredRecent = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.recentTransactions.filter((transaction) => {
      const categoryMatch =
        primaryView !== "recent" ||
        recentTab === "All" ||
        transaction.category === recentTab;
      const searchMatch =
        !term ||
        [
          transaction.reference,
          transaction.entryNumber,
          transaction.account,
          transaction.source,
          transaction.type,
          transaction.description ?? "",
          transaction.branch ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return categoryMatch && searchMatch;
    });
  }, [data.recentTransactions, primaryView, recentTab, search]);

  function runAction(action: () => Promise<ActionResult>, successText: string) {
    setToast(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.success) {
          const reference =
            result.entryNumber ?? result.paymentNumber ?? result.bankAccountId ?? "";
          setToast({
            ok: true,
            text: reference ? `${successText} (${reference})` : successText,
          });
          setModal(null);
          router.refresh();
        } else {
          setToast({ ok: false, text: result.error ?? "The action could not be completed" });
        }
      } catch (error) {
        setToast({
          ok: false,
          text: error instanceof Error ? error.message : "The action could not be completed",
        });
      }
    });
  }

  function openPostTab(tab: PostTab) {
    setPrimaryView("workspace");
    setPostTab(tab);
  }

  function openRecentTab(tab: RecentTab) {
    setPrimaryView("recent");
    setRecentTab(tab);
  }

  return (
    <div className={`${styles.shell} dashboard-content accountingWorkspacePage`}>
      <div className={styles.navigationRow}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => router.back()}
        >
          ← Previous page
        </button>
      </div>

      {showWorkspaceChrome && <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Double-entry accounting</div>
          <h1 className={styles.title}>Accounting</h1>
          <div className={styles.subtitle}>
            Cash-book control, subsidiary ledgers, trial balance checks, and
            the existing accounting tools for the accounts team.
          </div>
        </div>
        <div className={styles.statusPill}>
          {data.trialBalance.balanced ? (
            <CheckCircle size={16} aria-hidden="true" />
          ) : (
            <AlertCircle size={16} aria-hidden="true" />
          )}
          Trial balance {data.trialBalance.balanced ? "balanced" : "out of balance"}
        </div>
      </header>}

      {showWorkspaceChrome && <>
        <div className={styles.accountingNav}>
        <section className={styles.navSection} aria-label="Post">
          <div className={styles.navLabel}>Post</div>
          <div className={styles.pillRow}>
            {POST_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.pill} ${
                  primaryView === "workspace" && postTab === tab.key ? styles.pillActive : ""
                }`}
                onClick={() => openPostTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.navSection} aria-label="Recent transactions">
          <div className={styles.navLabel}>Recent Transactions</div>
          <div className={styles.pillRow}>
            {RECENT_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`${styles.pill} ${
                  primaryView === "recent" && recentTab === tab ? styles.pillActive : ""
                }`}
                onClick={() => openRecentTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </section>
        </div>

        <section className={styles.metrics} aria-label="Accounting totals">
        <Metric
          label="Cash at Bank"
          value={groupedMoney(data.cashBook.bank.balances)}
          sub={`${data.cashBook.bank.accounts.filter((account) => account.isActive).length} active accounts`}
        />
        <Metric
          label="Cash in Hand"
          value={groupedMoney(data.cashBook.cash.balances)}
          sub={`${data.cashBook.cash.accounts.filter((account) => account.isActive).length} active accounts`}
        />
        <Metric label="Debtors" value={money(data.debtors.total)} sub={`${data.debtors.rows.length} customer balances`} />
        <Metric
          label="Trial Balance"
          value={plainMoney(data.trialBalance.totalDebit)}
          sub={`Credits ${plainMoney(data.trialBalance.totalCredit)}`}
        />
        </section>

        {toast && <Toast value={toast} />}

        {!data.seeded && (
        <section className={`${styles.panel} ${styles.fullWidth}`}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>Standard chart of accounts required</div>
              <div className={styles.panelSub}>
                Load the standard Kenyan SME chart before posting transactions.
              </div>
            </div>
            <button
              type="button"
              className={styles.button}
              disabled={pending}
              onClick={() => runAction(() => seedChartOfAccounts(), "Standard accounts loaded")}
            >
              {pending ? <Loader2 size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
              Load standard accounts
            </button>
          </div>
        </section>
        )}
      </>}

      {primaryView === "overview" && <AccountingOverview data={data} />}

      {primaryView === "workspace" && postTab === "cash-book" && (
        <CashBookPanel
          bank={data.cashBook.bank}
          cash={data.cashBook.cash}
          search={search}
          onSearch={setSearch}
          onOpenModal={setModal}
        />
      )}

      {primaryView === "workspace" && postTab === "revenue" && (
        <RevenuePanel />
      )}

      {primaryView === "workspace" && postTab === "purchases" && (
        <PurchasesPanel data={data} />
      )}

      {primaryView === "workspace" && postTab === "payroll" && (
        <PayrollPanel payroll={data.payroll} pending={pending} runAction={runAction} />
      )}

      {primaryView === "recent" && (
        <RecentTransactionsPanel
          title={recentTab}
          transactions={filteredRecent}
          search={search}
          onSearch={setSearch}
        />
      )}

      {primaryView === "ledgers" && (
        <SubsidiaryLedgers
          debtors={data.debtors.rows}
          creditors={data.creditors.rows}
          employees={data.employees.rows}
          onOpenLedger={(title, row) => setModal({ kind: "ledger", title, row })}
        />
      )}

      {primaryView === "reports" && <ReportsPanel />}

      {modal?.kind === "add" && (
        <AddAccountModal
          group={modal.group}
          branches={data.options.branches}
          pending={pending}
          onClose={() => setModal(null)}
          runAction={runAction}
        />
      )}

      {modal?.kind === "edit" && (
        <EditAccountModal
          account={modal.account}
          branches={data.options.branches}
          pending={pending}
          onClose={() => setModal(null)}
          runAction={runAction}
        />
      )}

      {modal?.kind === "deactivate" && (
        <DeactivateAccountModal
          account={modal.account}
          pending={pending}
          onClose={() => setModal(null)}
          runAction={runAction}
        />
      )}

      {modal?.kind === "transaction" && (
        <TransactionModal
          mode={modal.mode}
          account={modal.account}
          data={data}
          pending={pending}
          onClose={() => setModal(null)}
          runAction={runAction}
        />
      )}

      {modal?.kind === "transactions" && (
        <AccountTransactionsModal
          account={modal.account}
          transactions={data.recentTransactions}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "ledger" && (
        <LedgerModal
          title={modal.title}
          row={modal.row}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

const OVERVIEW_LOAN_ACCOUNTS = [
  { code: "2300", name: "Loans Payable" },
  { code: "2310", name: "Customer Deposits" },
  { code: "2590", name: "Deferred Tax Liability" },
] as const;

const OVERVIEW_ACCENT_CLASSES = {
  green: styles.overviewAccentGreen,
  blue: styles.overviewAccentBlue,
  red: styles.overviewAccentRed,
  amber: styles.overviewAccentAmber,
};

function AccountingOverview({ data }: { data: AccountingWorkspaceData }) {
  const cashBankAccounts = data.accountBalances.filter(
    (account) =>
      account.type === "ASSET" &&
      (account.code.startsWith("10") || account.code.startsWith("11")),
  );
  const bankAccounts = cashBankAccounts.filter((account) => account.code.startsWith("11"));
  const cashAccounts = cashBankAccounts.filter((account) => account.code.startsWith("10"));
  const loanAccounts = data.accountBalances.filter((account) => {
    const code = Number(account.code);
    return account.type === "LIABILITY" && code >= 2300 && code <= 2590;
  });
  const loanRows = [
    ...OVERVIEW_LOAN_ACCOUNTS.map((overviewAccount) => {
      const account = loanAccounts.find((item) => item.code === overviewAccount.code);
      return {
        code: overviewAccount.code,
        name: account?.name ?? overviewAccount.name,
        balance: account?.balance ?? 0,
      };
    }),
    ...loanAccounts
      .filter((account) => !OVERVIEW_LOAN_ACCOUNTS.some((item) => item.code === account.code))
      .map((account) => ({
        code: account.code,
        name: account.name,
        balance: account.balance,
      })),
  ];
  const cashBankTotal = cashBankAccounts.reduce((total, account) => total + account.balance, 0);
  const bankTotal = bankAccounts.reduce((total, account) => total + account.balance, 0);
  const cashTotal = cashAccounts.reduce((total, account) => total + account.balance, 0);
  const loansTotal = loanRows.reduce((total, account) => total + account.balance, 0);

  return (
    <section className={styles.overview} aria-labelledby="accounting-overview-title">
      <div className={styles.overviewHeading}>
        <div>
          <div className={styles.eyebrow}>Accounting home</div>
          <h1 id="accounting-overview-title" className={styles.overviewTitle}>Overview</h1>
          <p className={styles.overviewSubtitle}>
            A clear view of cash, receivables, payables, and liabilities from posted journals.
          </p>
        </div>
        <Link href="/accounting?view=workspace" className={styles.overviewLink}>
          Open accountant
        </Link>
      </div>

      <div className={styles.overviewKpis}>
        <OverviewKpi
          label="Cash & bank"
          value={formatKsh(cashBankTotal)}
          sub={`Bank ${formatKsh(bankTotal)}`}
          accent="green"
        />
        <OverviewKpi
          label="Debtors"
          value={formatKsh(data.debtors.total)}
          sub="Receipts due"
          accent="blue"
        />
        <OverviewKpi
          label="Creditors"
          value={formatKsh(data.creditors.total)}
          sub={`Accruals ${formatKsh(data.creditors.total)}`}
          accent="red"
        />
        <OverviewKpi
          label="Loans"
          value={formatKsh(loansTotal)}
          sub="0 due in 30 days"
          accent="amber"
        />
      </div>

      <div className={styles.overviewGrid}>
        <OverviewCard eyebrow="Cash & bank balances" title="Cash & Bank" value={formatKsh(cashBankTotal)} accent="green">
          <div className={styles.overviewSplit}>
            <OverviewSplitItem label="At bank" value={formatKsh(bankTotal)} />
            <OverviewSplitItem label="Cash in hand" value={formatKsh(cashTotal)} />
          </div>
          <OverviewAccountRows accounts={cashBankAccounts} />
        </OverviewCard>

        <OverviewCard eyebrow="Outstanding loans" title="Loans" value={formatKsh(loansTotal)} accent="amber">
          <OverviewAccountRows accounts={loanRows} />
          <div className={styles.overviewPrepare}>
            <div className={styles.overviewPrepareLabel}>To prepare for</div>
            <p>No repayments due in the next 30 days.</p>
          </div>
        </OverviewCard>

        <OverviewCard eyebrow="Debtors & receipts due" title="Debtors" value={formatKsh(data.debtors.total)} accent="green">
          <OverviewPartyRows rows={data.debtors.rows} empty="No outstanding receipts." />
        </OverviewCard>

        <OverviewCard eyebrow="Creditors & accruals" title="Creditors" value={formatKsh(data.creditors.total)} accent="red">
          <OverviewPartyRows rows={data.creditors.rows} empty="No outstanding accruals." />
        </OverviewCard>
      </div>
    </section>
  );
}

function OverviewKpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: keyof typeof OVERVIEW_ACCENT_CLASSES;
}) {
  return (
    <div className={`${styles.metric} ${styles.overviewKpi} ${OVERVIEW_ACCENT_CLASSES[accent]}`}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricSub}>{sub}</div>
    </div>
  );
}

function OverviewCard({
  eyebrow,
  title,
  value,
  accent,
  children,
}: {
  eyebrow: string;
  title: string;
  value: string;
  accent: keyof typeof OVERVIEW_ACCENT_CLASSES;
  children: ReactNode;
}) {
  return (
    <article className={`${styles.card} ${styles.overviewCard} ${OVERVIEW_ACCENT_CLASSES[accent]}`}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.overviewCardEyebrow}>{eyebrow}</div>
          <h2 className={styles.cardTitle}>{title}</h2>
        </div>
        <div className={styles.groupBalance}>
          <div className={styles.groupBalanceLabel}>Balance</div>
          <div className={styles.groupBalanceValue}>{value}</div>
        </div>
      </div>
      <div className={styles.overviewCardBody}>{children}</div>
    </article>
  );
}

function OverviewSplitItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.overviewSplitItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OverviewAccountRows({
  accounts,
}: {
  accounts: Array<{ code: string; name: string; balance: number }>;
}) {
  return (
    <div className={styles.overviewRows}>
      {accounts.length === 0 ? (
        <div className={styles.overviewEmpty}>No account balances recorded.</div>
      ) : (
        accounts.map((account) => (
          <div className={styles.overviewRow} key={`${account.code}-${account.name}`}>
            <span>
              <b>{account.code}</b>
              {account.name}
            </span>
            <strong>{formatKsh(account.balance)}</strong>
          </div>
        ))
      )}
    </div>
  );
}

function OverviewPartyRows({
  rows,
  empty,
}: {
  rows: AgeingRow[];
  empty: string;
}) {
  return (
    <div className={styles.overviewRows}>
      {rows.length === 0 ? (
        <div className={styles.overviewEmpty}>{empty}</div>
      ) : (
        rows.slice(0, 6).map((row) => (
          <div className={styles.overviewRow} key={row.id}>
            <span>{row.name}</span>
            <strong>{formatKsh(row.total)}</strong>
          </div>
        ))
      )}
    </div>
  );
}

function RevenuePanel() {
  return (
    <section className={styles.revenuePage} aria-labelledby="revenue-title">
      <h2 id="revenue-title" className={styles.revenueTitle}>Revenue</h2>
      <div className={styles.revenueGrid}>
        <RevenueActionCard
          title="Create invoice"
          description="Post a customer sales invoice"
          label="Customer invoice"
          href="/accounting/transactions?tab=invoice"
        />
        <RevenueActionCard
          title="Create credit note"
          description="Record a customer revenue reversal"
          label="Customer credit"
          href="/accounting/transactions?tab=credit-note"
        />
      </div>
    </section>
  );
}

function RevenueActionCard({
  title,
  description,
  label,
  href,
}: {
  title: string;
  description: string;
  label: string;
  href: string;
}) {
  return (
    <article className={styles.revenueCard}>
      <div className={styles.revenueEyebrow}>Revenue</div>
      <h3 className={styles.revenueCardTitle}>{title}</h3>
      <p className={styles.revenueDescription}>{description}</p>
      <div className={styles.revenueLabel}>{label}</div>
      <Link className={styles.revenueButton} href={href}>{title}</Link>
    </article>
  );
}

function PurchasesPanel({ data }: { data: AccountingWorkspaceData }) {
  const billCount = data.recentTransactions.filter(
    (transaction) => transaction.type === "Bill",
  ).length;
  const debitNoteCount = data.recentTransactions.filter(
    (transaction) => transaction.type === "Debit Note",
  ).length;

  return (
    <section className={styles.purchasesPage} aria-labelledby="purchases-title">
      <h2 id="purchases-title" className={styles.purchasesTitle}>Purchases</h2>
      <div className={styles.purchasesGrid}>
        <PurchaseActionCard
          title="Create bill"
          eyebrow="Create bills"
          value={formatKsh(data.creditors.total)}
          description="Supplier purchase bills posted to payables"
          transactionCount={billCount}
          href="/accounting/transactions?tab=bill"
          featured
        />
        <PurchaseActionCard
          title="Create debit note"
          eyebrow="Create debit note"
          value={formatKsh(0)}
          description="Supplier debit notes reducing purchases and payables"
          transactionCount={debitNoteCount}
          href="/accounting/transactions?tab=debit-note"
        />
      </div>
    </section>
  );
}

function PurchaseActionCard({
  title,
  eyebrow,
  value,
  description,
  transactionCount,
  href,
  featured = false,
}: {
  title: string;
  eyebrow: string;
  value: string;
  description: string;
  transactionCount: number;
  href: string;
  featured?: boolean;
}) {
  return (
    <article className={`${styles.purchaseCard} ${featured ? styles.purchaseCardFeatured : ""}`}>
      <div className={styles.purchaseCardHeader}>
        <div className={styles.purchaseEyebrow}>{eyebrow}</div>
        <Link className={styles.purchaseButton} href={href}>
          <Plus size={16} aria-hidden="true" />
          {title}
        </Link>
      </div>
      <div className={styles.purchaseValue}>{value}</div>
      <p className={styles.purchaseDescription}>{description}</p>
      <div className={styles.purchaseCount}>{transactionCount} transactions</div>
    </article>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricSub}>{sub}</div>
    </div>
  );
}

function Toast({ value }: { value: { ok: boolean; text: string } }) {
  return (
    <div className={`${styles.toast} ${value.ok ? styles.toastOk : styles.toastError}`} role="status">
      {value.ok ? (
        <CheckCircle size={16} aria-hidden="true" />
      ) : (
        <AlertCircle size={16} aria-hidden="true" />
      )}
      {value.text}
    </div>
  );
}

function CashBookPanel({
  bank,
  cash,
  search,
  onSearch,
  onOpenModal,
}: {
  bank: CashBookGroup;
  cash: CashBookGroup;
  search: string;
  onSearch: (value: string) => void;
  onOpenModal: (modal: ModalState) => void;
}) {
  return (
    <div className={styles.workspaceGrid}>
      <AccountGroupCard
        group={bank}
        icon={<Landmark size={16} aria-hidden="true" />}
        search={search}
        onSearch={onSearch}
        onOpenModal={onOpenModal}
      />
      <AccountGroupCard
        group={cash}
        icon={<Wallet size={16} aria-hidden="true" />}
        search={search}
        onSearch={onSearch}
        onOpenModal={onOpenModal}
      />
    </div>
  );
}

function AccountGroupCard({
  group,
  icon,
  search,
  onSearch,
  onOpenModal,
}: {
  group: CashBookGroup;
  icon: ReactNode;
  search: string;
  onSearch: (value: string) => void;
  onOpenModal: (modal: ModalState) => void;
}) {
  const filteredAccounts = group.accounts.filter((account) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      [
        account.name,
        account.accountNumber ?? "",
        account.bankName ?? "",
        account.glCode,
        account.branchName ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  });

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>{group.title}</div>
          <div className={styles.cardMeta}>
            {group.accounts.filter((account) => account.isActive).length} active accounts
          </div>
        </div>
        <div className={styles.groupBalance}>
          <div className={styles.groupBalanceLabel}>Group Balance</div>
          <div className={styles.groupBalanceValue}>{groupedMoney(group.balances)}</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search aria-hidden="true" />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search accounts, branch, number"
          />
        </div>
        <button
          type="button"
          className={styles.button}
          onClick={() => onOpenModal({ kind: "add", group: group.key })}
        >
          <Plus size={15} aria-hidden="true" />
          Add Account
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Account Details</th>
              <th>Currency</th>
              <th className={styles.num}>Balance</th>
              <th>Reconciliation</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  No accounts match this view.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account) => (
                <tr key={account.id}>
                  <td>
                    <div className={styles.accountName}>
                      <span className={styles.accountIcon}>{icon}</span>
                      <span>
                        {account.name}
                        <span className={styles.muted}> · GL {account.glCode}</span>
                      </span>
                    </div>
                  </td>
                  <td className={styles.muted}>{accountDetails(account)}</td>
                  <td>{account.currency}</td>
                  <td className={styles.num}>{money(account.balance, account.currency)}</td>
                  <td>
                    <span className={styles.badge}>{account.reconciliationStatus}</span>
                  </td>
                  <td>
                    <span className={account.isActive ? styles.statusActive : styles.statusInactive}>
                      {account.status}
                    </span>
                  </td>
                  <td>
                    <AccountMenu
                      account={account}
                      onOpenModal={onOpenModal}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AccountMenu({
  account,
  onOpenModal,
}: {
  account: CashBookAccountRow;
  onOpenModal: (modal: ModalState) => void;
}) {
  const canWriteCheque = account.group === "BANK" && account.isActive;

  return (
    <details className={styles.menu}>
      <summary className={styles.iconButton} aria-label={`Actions for ${account.name}`}>
        <MoreHorizontal size={16} aria-hidden="true" />
      </summary>
      <div className={styles.menuPanel}>
        <button type="button" onClick={() => onOpenModal({ kind: "transaction", mode: "deposit", account })}>
          <Receipt size={15} aria-hidden="true" />
          Receive Deposit
        </button>
        <button
          type="button"
          disabled={!canWriteCheque}
          title={canWriteCheque ? undefined : "Cheques can only be written from active bank accounts"}
          onClick={() => onOpenModal({ kind: "transaction", mode: "cheque", account })}
        >
          <FileText size={15} aria-hidden="true" />
          Write Cheque
        </button>
        <button type="button" onClick={() => onOpenModal({ kind: "transaction", mode: "journal", account })}>
          <BookOpen size={15} aria-hidden="true" />
          Journal Entry
        </button>
        <button type="button" onClick={() => onOpenModal({ kind: "transaction", mode: "reconcile", account })}>
          <CheckCircle size={15} aria-hidden="true" />
          Reconcile
        </button>
        <button type="button" onClick={() => onOpenModal({ kind: "transactions", account })}>
          <Eye size={15} aria-hidden="true" />
          View Transactions
        </button>
        <Link href={`/accounting/ledger?account=${account.accountId}`}>
          <BookOpen size={15} aria-hidden="true" />
          View Ledger
        </Link>
        <button type="button" onClick={() => onOpenModal({ kind: "edit", account })}>
          <Pencil size={15} aria-hidden="true" />
          Edit Account
        </button>
        <button
          type="button"
          disabled={!account.isActive}
          onClick={() => onOpenModal({ kind: "deactivate", account })}
        >
          <Ban size={15} aria-hidden="true" />
          Deactivate Account
        </button>
      </div>
    </details>
  );
}

function PostingPanel({
  mode,
  title,
  description,
  data,
  pending,
  runAction,
}: {
  mode: "deposit" | "cheque";
  title: string;
  description: string;
  data: AccountingWorkspaceData;
  pending: boolean;
  runAction: (action: () => Promise<ActionResult>, successText: string) => void;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>{title}</div>
          <div className={styles.panelSub}>{description}</div>
        </div>
      </div>
      <TransactionForm
        mode={mode}
        data={data}
        pending={pending}
        runAction={runAction}
      />
    </section>
  );
}

function RecentTransactionsPanel({
  title,
  transactions,
  search,
  onSearch,
}: {
  title: string;
  transactions: RecentAccountingTransaction[];
  search: string;
  onSearch: (value: string) => void;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const visible = transactions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>{title}</div>
          <div className={styles.panelSub}>Posted journals, payments, and cash-book movements.</div>
        </div>
        <div className={styles.searchWrap}>
          <Search aria-hidden="true" />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(event) => {
              setPage(1);
              onSearch(event.target.value);
            }}
            placeholder="Search source, account, reference"
          />
        </div>
      </div>
      <TransactionsTable transactions={visible} />
      <Pagination
        page={page}
        totalPages={totalPages}
        onPage={setPage}
      />
    </section>
  );
}

function TransactionsTable({
  transactions,
}: {
  transactions: RecentAccountingTransaction[];
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Reference</th>
            <th>Account</th>
            <th>Source</th>
            <th>Type</th>
            <th className={styles.num}>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={7} className={styles.empty}>
                No transactions match this view.
              </td>
            </tr>
          ) : (
            transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{transaction.date}</td>
                <td>{transaction.reference}</td>
                <td>{transaction.account}</td>
                <td>
                  {transaction.source}
                  <span className={styles.muted}> · {transaction.sourceType}</span>
                </td>
                <td>{transaction.type}</td>
                <td className={styles.num}>{money(transaction.amount)}</td>
                <td>
                  <span className={styles.badge}>{transaction.status}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className={styles.pagination}>
      <button
        type="button"
        className={styles.ghostButton}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      Page {page} of {totalPages}
      <button
        type="button"
        className={styles.ghostButton}
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

function SubsidiaryLedgers({
  debtors,
  creditors,
  employees,
  onOpenLedger,
}: {
  debtors: AgeingRow[];
  creditors: AgeingRow[];
  employees: AccountingWorkspaceData["employees"]["rows"];
  onOpenLedger: (title: string, row: AgeingRow) => void;
}) {
  const [tab, setTab] = useState<"debtors" | "creditors" | "employees">("debtors");

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>Debtors/Creditors</div>
          <div className={styles.panelSub}>Customer, supplier, and employee subsidiary balances.</div>
        </div>
      </div>
      <div className={styles.tabs}>
        {(["debtors", "creditors", "employees"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`${styles.pill} ${tab === item ? styles.pillActive : ""}`}
            onClick={() => setTab(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === "debtors" && (
        <AgeingTable
          label="Customer"
          rows={debtors}
          onOpen={(row) => onOpenLedger("Customer ledger", row)}
        />
      )}
      {tab === "creditors" && (
        <AgeingTable
          label="Supplier"
          rows={creditors}
          onOpen={(row) => onOpenLedger("Supplier ledger", row)}
        />
      )}
      {tab === "employees" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Employee</th>
                <th className={styles.num}>Advances</th>
                <th className={styles.num}>Reimbursements</th>
                <th className={styles.num}>Payroll Deductions</th>
                <th className={styles.num}>Amount Receivable</th>
                <th className={styles.num}>Amount Payable</th>
                <th className={styles.num}>Net Current Balance</th>
                <th>Last Transaction</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    No employee ledger balances yet.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.name}</td>
                    <td className={styles.num}>{plainMoney(employee.advances)}</td>
                    <td className={styles.num}>{plainMoney(employee.reimbursements)}</td>
                    <td className={styles.num}>{plainMoney(employee.payrollDeductions)}</td>
                    <td className={styles.num}>{plainMoney(employee.amountReceivable)}</td>
                    <td className={styles.num}>{plainMoney(employee.amountPayable)}</td>
                    <td className={styles.num}>{plainMoney(employee.netCurrentBalance)}</td>
                    <td>{employee.lastTransactionDate ?? "-"}</td>
                    <td><span className={styles.badge}>{employee.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AgeingTable({
  label,
  rows,
  onOpen,
}: {
  label: "Customer" | "Supplier";
  rows: AgeingRow[];
  onOpen: (row: AgeingRow) => void;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{label}</th>
            <th className={styles.num}>Current</th>
            <th className={styles.num}>1-30 Days</th>
            <th className={styles.num}>31-60 Days</th>
            <th className={styles.num}>61-90 Days</th>
            <th className={styles.num}>90 Days</th>
            <th className={styles.num}>Total Outstanding</th>
            <th>Last Transaction</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className={styles.empty}>
                No balances yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} tabIndex={0} onClick={() => onOpen(row)}>
                <td>{row.name}</td>
                <td className={styles.num}>{plainMoney(row.current)}</td>
                <td className={styles.num}>{plainMoney(row.days1To30)}</td>
                <td className={styles.num}>{plainMoney(row.days31To60)}</td>
                <td className={styles.num}>{plainMoney(row.days61To90)}</td>
                <td className={styles.num}>{plainMoney(row.over90)}</td>
                <td className={styles.num}>{plainMoney(row.total)}</td>
                <td>{row.lastTransactionDate ?? "-"}</td>
                <td><span className={styles.badge}>{row.status}</span></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReportsPanel() {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>Reports</div>
          <div className={styles.panelSub}>Financial statements, ageing reports, books, and transaction history.</div>
        </div>
      </div>
      <div className={styles.reportsGrid}>
        {REPORT_LINKS.map((report) => (
          <Link key={report.href} href={report.href} className={styles.reportItem}>
            <span>
              <strong>{report.title}</strong>
              <small>{report.description}</small>
            </span>
            <FileText size={16} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function AddAccountModal({
  group,
  branches,
  pending,
  onClose,
  runAction,
}: {
  group: CashBookGroupKey;
  branches: AccountingWorkspaceData["options"]["branches"];
  pending: boolean;
  onClose: () => void;
  runAction: (action: () => Promise<ActionResult>, successText: string) => void;
}) {
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [cashType, setCashType] = useState(CASH_TYPES[0]);
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingBalanceDate, setOpeningBalanceDate] = useState(today());
  const [branchId, setBranchId] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runAction(
      () =>
        createCashBookAccount({
          group,
          bankName,
          accountName,
          accountNumber,
          cashType,
          openingBalance: Number(openingBalance || 0),
          openingBalanceDate,
          branchId: branchId || null,
          currency,
          description,
          isActive,
        }),
      "Account added",
    );
  }

  return (
    <Modal title={group === "BANK" ? "Add Cash at Bank Account" : "Add Cash in Hand Account"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className={styles.modalBody}>
          <div className={styles.formGrid}>
            {group === "BANK" ? (
              <Field label="Bank Name">
                <input className={styles.input} required value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="KCB, Equity, NCBA" />
              </Field>
            ) : (
              <Field label="Type">
                <select className={styles.select} value={cashType} onChange={(event) => setCashType(event.target.value)}>
                  {CASH_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Account Name">
              <input className={styles.input} required value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder={group === "BANK" ? "KCB Main Account" : "Petty Cash"} />
            </Field>
            <Field label="Account Number">
              <input className={styles.input} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder={group === "BANK" ? "Account number" : "Till or wallet number"} />
            </Field>
            <Field label="Opening Balance">
              <input className={styles.input} type="number" min="0" step="0.01" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Opening Balance Date">
              <input className={styles.input} type="date" value={openingBalanceDate} onChange={(event) => setOpeningBalanceDate(event.target.value)} />
            </Field>
            <Field label="Branch">
              <select className={styles.select} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">No branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <input className={styles.input} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} />
            </Field>
            <Field label="Description">
              <input className={styles.input} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional" />
            </Field>
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Active account
            </label>
          </div>
        </div>
        <ModalFooter pending={pending} submitLabel="Add account" onClose={onClose} />
      </form>
    </Modal>
  );
}

function EditAccountModal({
  account,
  branches,
  pending,
  onClose,
  runAction,
}: {
  account: CashBookAccountRow;
  branches: AccountingWorkspaceData["options"]["branches"];
  pending: boolean;
  onClose: () => void;
  runAction: (action: () => Promise<ActionResult>, successText: string) => void;
}) {
  const isDeactivate = account.name.startsWith("__deactivate__");
  const displayName = isDeactivate ? account.name.replace("__deactivate__", "") : account.name;
  const [accountName, setAccountName] = useState(displayName);
  const [bankName, setBankName] = useState(account.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(account.accountNumber ?? "");
  const [branchId, setBranchId] = useState(account.branchId ?? "");
  const [currency, setCurrency] = useState(account.currency);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDeactivate) {
      runAction(
        () => deactivateCashBookAccount(account.bankAccountId),
        "Account deactivated",
      );
      return;
    }

    runAction(
      () =>
        updateCashBookAccount({
          bankAccountId: account.bankAccountId,
          accountName,
          bankName,
          accountNumber,
          branchId: branchId || null,
          currency,
        }),
      "Account updated",
    );
  }

  return (
    <Modal title={isDeactivate ? "Deactivate Account" : "Edit Account"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className={styles.modalBody}>
          {isDeactivate ? (
            <div className={styles.toast}>
              <AlertCircle size={16} aria-hidden="true" />
              {displayName} can be deactivated only when its balance is zero.
            </div>
          ) : (
            <div className={styles.formGrid}>
              <Field label="Account Name">
                <input className={styles.input} required value={accountName} onChange={(event) => setAccountName(event.target.value)} />
              </Field>
              <Field label="Bank or Type">
                <input className={styles.input} value={bankName} onChange={(event) => setBankName(event.target.value)} />
              </Field>
              <Field label="Account Number">
                <input className={styles.input} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
              </Field>
              <Field label="Branch">
                <select className={styles.select} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                  <option value="">No branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <input className={styles.input} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} />
              </Field>
            </div>
          )}
        </div>
        <ModalFooter pending={pending} submitLabel={isDeactivate ? "Deactivate account" : "Save changes"} onClose={onClose} danger={isDeactivate} />
      </form>
    </Modal>
  );
}

function DeactivateAccountModal({
  account,
  pending,
  onClose,
  runAction,
}: {
  account: CashBookAccountRow;
  pending: boolean;
  onClose: () => void;
  runAction: (action: () => Promise<ActionResult>, successText: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runAction(
      () => deactivateCashBookAccount(account.bankAccountId),
      "Account deactivated",
    );
  }

  return (
    <Modal title="Deactivate Account" onClose={onClose}>
      <form onSubmit={submit}>
        <div className={styles.modalBody}>
          <div className={`${styles.toast} ${styles.toastError}`}>
            <AlertCircle size={16} aria-hidden="true" />
            {account.name} can be deactivated only when its ledger-derived balance is zero.
          </div>
        </div>
        <ModalFooter pending={pending} submitLabel="Deactivate account" onClose={onClose} danger />
      </form>
    </Modal>
  );
}

function TransactionModal({
  mode,
  account,
  data,
  pending,
  onClose,
  runAction,
}: {
  mode: TransactionMode;
  account?: CashBookAccountRow;
  data: AccountingWorkspaceData;
  pending: boolean;
  onClose: () => void;
  runAction: (action: () => Promise<ActionResult>, successText: string) => void;
}) {
  const titles: Record<TransactionMode, string> = {
    deposit: "Receive Deposit",
    cheque: "Write Cheque",
    journal: "Journal Entry",
    reconcile: "Reconcile",
  };

  return (
    <Modal title={account ? `${titles[mode]} - ${account.name}` : titles[mode]} onClose={onClose}>
      <TransactionForm
        mode={mode}
        account={account}
        data={data}
        pending={pending}
        runAction={runAction}
        onCancel={onClose}
      />
    </Modal>
  );
}

function TransactionForm({
  mode,
  account,
  data,
  pending,
  runAction,
  onCancel,
}: {
  mode: TransactionMode;
  account?: CashBookAccountRow;
  data: AccountingWorkspaceData;
  pending: boolean;
  runAction: (action: () => Promise<ActionResult>, successText: string) => void;
  onCancel?: () => void;
}) {
  const [bankAccountId, setBankAccountId] = useState(account?.bankAccountId ?? data.options.cashBookAccounts[0]?.bankAccountId ?? "");
  const selectedAccount = data.options.cashBookAccounts.find((item) => item.bankAccountId === bankAccountId) ?? account ?? null;
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [incomeAccountId, setIncomeAccountId] = useState(data.options.incomeAccounts[0]?.id ?? "");
  const [expenseAccountId, setExpenseAccountId] = useState(data.options.expenseAccounts[0]?.id ?? "");
  const [counterpartAccountId, setCounterpartAccountId] = useState("");
  const [cashSide, setCashSide] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [employeePostingKind, setEmployeePostingKind] =
    useState<EmployeePostingKind>("ADVANCE_PAID");
  const [statementBalance, setStatementBalance] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function numericAmount() {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function requireSourceClassification() {
    if ((mode === "deposit" || mode === "cheque") && !sourceName.trim()) {
      setLocalError("Enter a source name before posting");
      return false;
    }
    if ((mode === "deposit" || mode === "cheque") && !sourceType) {
      setLocalError("Classify the source before posting");
      return false;
    }
    if (
      (sourceType === "Customer" || sourceType === "Supplier" || sourceType === "Employee") &&
      !sourceId
    ) {
      setLocalError(`Select an existing ${sourceType.toLowerCase()} to update the subsidiary ledger`);
      return false;
    }
    return true;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    const parsedAmount = numericAmount();
    if (!bankAccountId) return setLocalError("Select a cash or bank account");
    if (mode !== "reconcile" && parsedAmount <= 0) return setLocalError("Enter a valid amount");
    if (!requireSourceClassification()) return;
    if (mode === "cheque" && selectedAccount?.group === "CASH") {
      return setLocalError("Write Cheque can only be used with bank accounts");
    }
    if (!window.confirm("Post this transaction to the ledger?")) return;

    if (mode === "deposit" || mode === "cheque") {
      if (sourceType === "Other" && mode === "deposit" && !incomeAccountId) {
        return setLocalError("Select a revenue account");
      }
      if (sourceType === "Other" && mode === "cheque" && !expenseAccountId) {
        return setLocalError("Select an expense account");
      }
      runAction(
        () =>
          postCashBookTransaction({
            mode,
            date,
            amount: parsedAmount,
            bankAccountId,
            sourceName,
            sourceType: sourceType!,
            sourceId,
            incomeAccountId,
            expenseAccountId,
            employeePostingKind,
            memo: memo || undefined,
            reference: reference || undefined,
          }),
        mode === "deposit" ? "Deposit posted" : "Cheque posted",
      );
      return;
    }

    if (mode === "journal") {
      if (!counterpartAccountId) return setLocalError("Select a counter account");
      runAction(
        () =>
          postCashBookJournal({
            bankAccountId,
            date,
            amount: parsedAmount,
            reference: reference || undefined,
            memo: memo || undefined,
            cashSide,
            counterpartAccountId,
          }),
        "Journal posted",
      );
      return;
    }

    if (mode === "reconcile") {
      if (!selectedAccount) return setLocalError("Select a cash or bank account");
      const parsedStatementBalance = Number(statementBalance);
      if (!Number.isFinite(parsedStatementBalance)) {
        return setLocalError("Enter the statement balance");
      }
      const difference = Math.round((parsedStatementBalance - selectedAccount.balance) * 100) / 100;
      if (Math.abs(difference) < 0.01) {
        setLocalError("Statement agrees with the book balance. No journal is required.");
        return;
      }
      if (!counterpartAccountId) return setLocalError("Select a counter account for the reconciliation difference");
      runAction(
        () =>
          postCashBookJournal({
            bankAccountId,
            date,
            amount: Math.abs(difference),
            reference: reference || undefined,
            memo: memo || `Reconciliation difference for ${selectedAccount.name}`,
            cashSide: difference > 0 ? "DEBIT" : "CREDIT",
            counterpartAccountId,
          }),
        "Reconciliation adjustment posted",
      );
    }
  }

  const showSource = mode === "deposit" || mode === "cheque";
  const showAmount = mode !== "reconcile";
  const showRevenueAccount = mode === "deposit" && sourceType === "Other";
  const showExpenseAccount = mode === "cheque" && sourceType === "Other";
  const showCounterpart = mode === "journal" || mode === "reconcile";
  const showEmployeeKind = mode === "cheque" && sourceType === "Employee";

  return (
    <form onSubmit={submit}>
      <div className={styles.modalBody}>
        {localError && (
          <div className={`${styles.toast} ${localError.includes("No journal") ? styles.toastOk : styles.toastError}`}>
            <AlertCircle size={16} aria-hidden="true" />
            {localError}
          </div>
        )}
        {selectedAccount && (
          <div className={styles.accountContext}>
            <div>
              <div className={styles.contextLabel}>Account</div>
              <div className={styles.contextTitle}>{selectedAccount.name}</div>
              <div className={styles.contextMeta}>
                {accountDetails(selectedAccount)} · Current balance {money(selectedAccount.balance, selectedAccount.currency)}
              </div>
            </div>
            <span className={styles.badge}>{selectedAccount.status}</span>
          </div>
        )}
        <div className={styles.formGrid}>
          {!account && (
            <Field label="Cash/Bank Account">
              <select className={styles.select} required value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
                {data.options.cashBookAccounts.map((item) => (
                  <option key={item.bankAccountId} value={item.bankAccountId}>{item.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Date">
            <input className={styles.input} type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          {showAmount && (
            <Field label="Amount">
              <input className={styles.input} type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
            </Field>
          )}
          {mode === "reconcile" && (
            <Field label="Statement Balance">
              <input className={styles.input} type="number" step="0.01" required value={statementBalance} onChange={(event) => setStatementBalance(event.target.value)} placeholder="0.00" />
            </Field>
          )}
          {showSource && (
            <SourceSelector
              parties={data.options.parties}
              sourceName={sourceName}
              sourceId={sourceId}
              sourceType={sourceType}
              setSourceName={setSourceName}
              setSourceId={setSourceId}
              setSourceType={setSourceType}
            />
          )}
          {showRevenueAccount && (
            <AccountSelect label="Revenue Account" value={incomeAccountId} accounts={data.options.incomeAccounts} onChange={setIncomeAccountId} />
          )}
          {showExpenseAccount && (
            <AccountSelect label="Expense Account" value={expenseAccountId} accounts={data.options.expenseAccounts} onChange={setExpenseAccountId} />
          )}
          {mode === "journal" && (
            <Field label="Cash Side">
              <select className={styles.select} value={cashSide} onChange={(event) => setCashSide(event.target.value as "DEBIT" | "CREDIT")}>
                <option value="DEBIT">Debit cash account</option>
                <option value="CREDIT">Credit cash account</option>
              </select>
            </Field>
          )}
          {showEmployeeKind && (
            <Field label="Employee Transaction">
              <select
                className={styles.select}
                value={employeePostingKind}
                onChange={(event) => setEmployeePostingKind(event.target.value as EmployeePostingKind)}
              >
                <option value="ADVANCE_PAID">Salary advance or employee loan</option>
                <option value="REIMBURSEMENT_PAID">Reimbursement paid</option>
              </select>
            </Field>
          )}
          {showCounterpart && (
            <AccountSelect label="Counter Account" value={counterpartAccountId} accounts={data.options.accounts.filter((item) => item.id !== selectedAccount?.accountId)} onChange={setCounterpartAccountId} />
          )}
          <Field label="Reference">
            <input className={styles.input} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference, cheque, invoice" />
          </Field>
          <Field label="Description">
            <input className={styles.input} value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Memo" />
          </Field>
        </div>
        <PostingPreview
          mode={mode}
          selectedAccount={selectedAccount}
          sourceName={sourceName}
          sourceType={sourceType}
          date={date}
          amount={numericAmount()}
          reference={reference}
          incomeAccountId={incomeAccountId}
          expenseAccountId={expenseAccountId}
          counterpartAccountId={counterpartAccountId}
          cashSide={cashSide}
          employeePostingKind={employeePostingKind}
          accounts={data.options.accounts}
        />
      </div>
      <ModalFooter pending={pending} submitLabel={mode === "reconcile" ? "Post adjustment" : "Post transaction"} onClose={onCancel} />
    </form>
  );
}

function PostingPreview({
  mode,
  selectedAccount,
  sourceName,
  sourceType,
  date,
  amount,
  reference,
  incomeAccountId,
  expenseAccountId,
  counterpartAccountId,
  cashSide,
  employeePostingKind,
  accounts,
}: {
  mode: TransactionMode;
  selectedAccount: CashBookAccountRow | null;
  sourceName: string;
  sourceType: SourceType | null;
  date: string;
  amount: number;
  reference: string;
  incomeAccountId: string;
  expenseAccountId: string;
  counterpartAccountId: string;
  cashSide: "DEBIT" | "CREDIT";
  employeePostingKind: EmployeePostingKind;
  accounts: AccountOption[];
}) {
  const accountName = selectedAccount?.name ?? "Selected cash/bank account";
  const byId = new Map(accounts.map((account) => [account.id, `${account.code} - ${account.name}`]));
  const controlAccount =
    sourceType === "Customer"
      ? "Accounts Receivable control"
      : sourceType === "Supplier"
        ? "Accounts Payable control"
        : sourceType === "Employee"
          ? employeePostingKind === "REIMBURSEMENT_PAID"
            ? "Employee Payables control"
            : "Employee Receivables control"
          : null;

  let debit = "";
  let credit = "";
  if (mode === "deposit") {
    debit = accountName;
    credit =
      controlAccount ??
      byId.get(incomeAccountId) ??
      "Revenue account";
  } else if (mode === "cheque") {
    debit =
      controlAccount ??
      byId.get(expenseAccountId) ??
      "Expense account";
    credit = accountName;
  } else if (mode === "journal") {
    const counter = byId.get(counterpartAccountId) ?? "Counter account";
    debit = cashSide === "DEBIT" ? accountName : counter;
    credit = cashSide === "DEBIT" ? counter : accountName;
  } else {
    const counter = byId.get(counterpartAccountId) ?? "Counter account";
    debit = "Reconciliation difference account";
    credit = counter;
  }

  return (
    <div className={styles.postingPreview}>
      <div className={styles.previewTitle}>Posting preview</div>
      <div className={styles.previewGrid}>
        <span>Account</span>
        <strong>{accountName}</strong>
        <span>Transaction type</span>
        <strong>{mode === "deposit" ? "Receive Deposit" : mode === "cheque" ? "Write Cheque" : mode === "journal" ? "Journal Entry" : "Reconcile"}</strong>
        <span>Source</span>
        <strong>{sourceName || "Not entered"}</strong>
        <span>Source type</span>
        <strong>{sourceTypeLabel(sourceType)}</strong>
        <span>Date</span>
        <strong>{date}</strong>
        <span>Amount</span>
        <strong>{amount > 0 ? money(amount, selectedAccount?.currency ?? "KES") : "-"}</strong>
        <span>Debit account</span>
        <strong>{debit}</strong>
        <span>Credit account</span>
        <strong>{credit}</strong>
        <span>Reference</span>
        <strong>{reference || "-"}</strong>
      </div>
    </div>
  );
}

function SourceSelector({
  parties,
  sourceName,
  sourceId,
  sourceType,
  setSourceName,
  setSourceId,
  setSourceType,
}: {
  parties: AccountingWorkspaceData["options"]["parties"];
  sourceName: string;
  sourceId: string | null;
  sourceType: SourceType | null;
  setSourceName: (value: string) => void;
  setSourceId: (value: string | null) => void;
  setSourceType: (value: SourceType | null) => void;
}) {
  const listId = "accounting-source-options";

  function updateSourceName(value: string) {
    const party = parties.find((item) => item.name.toLowerCase() === value.trim().toLowerCase());
    setSourceName(value);
    setSourceId(party?.id ?? null);
    setSourceType(null);
  }

  function classify(type: SourceType) {
    const classifiedParty = resolveClassifiedSource(parties, {
      sourceName,
      sourceId,
      sourceType: type,
    });
    setSourceType(type);
    setSourceId(classifiedParty?.id ?? null);
  }

  return (
    <div className={`${styles.field} ${styles.sourceBox}`}>
      <label>Source Name</label>
      <input
        className={styles.input}
        list={listId}
        value={sourceName}
        onChange={(event) => updateSourceName(event.target.value)}
        placeholder="Select or type a source"
      />
      <datalist id={listId}>
        {parties.map((party) => (
          <option key={`${party.type}-${party.id}`} value={party.name} />
        ))}
      </datalist>
      {sourceName.trim() && !sourceType && (
        <div className={styles.sourcePopover}>
          <div className={styles.popoverTitle}>Classify Source</div>
          <div className={styles.popoverQuestion}>What type of source is this?</div>
          <div className={styles.optionGrid}>
            {(["Customer", "Supplier", "Employee", "Other"] as SourceType[]).map((type) => (
              <button key={type} type="button" className={styles.optionButton} onClick={() => classify(type)}>
                {type}
              </button>
            ))}
          </div>
        </div>
      )}
      {sourceName.trim() && sourceType && (
        <div className={styles.metricSub}>
          {sourceType} {sourceId ? "selected" : "entered"}
        </div>
      )}
    </div>
  );
}

function AccountSelect({
  label,
  value,
  accounts,
  onChange,
}: {
  label: string;
  value: string;
  accounts: AccountOption[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select className={styles.select} required value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select account</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
        ))}
      </select>
    </Field>
  );
}

function AccountTransactionsModal({
  account,
  transactions,
  onClose,
}: {
  account: CashBookAccountRow;
  transactions: RecentAccountingTransaction[];
  onClose: () => void;
}) {
  const filtered = transactions.filter(
    (transaction) =>
      transaction.bankAccountId === account.bankAccountId ||
      transaction.accountId === account.accountId,
  );

  return (
    <Modal title={`Transactions - ${account.name}`} onClose={onClose}>
      <div className={styles.modalBody}>
        <TransactionsTable transactions={filtered} />
      </div>
    </Modal>
  );
}

function LedgerModal({
  title,
  row,
  onClose,
}: {
  title: string;
  row: AgeingRow;
  onClose: () => void;
}) {
  return (
    <Modal title={`${title} - ${row.name}`} onClose={onClose}>
      <div className={styles.modalBody}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th className={styles.num}>Debit</th>
                <th className={styles.num}>Credit</th>
                <th className={styles.num}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {row.ledger.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>No ledger lines yet.</td>
                </tr>
              ) : (
                row.ledger.map((line) => (
                  <tr key={`${line.date}-${line.reference}-${line.description}`}>
                    <td>{line.date}</td>
                    <td>{line.reference}</td>
                    <td>{line.description}</td>
                    <td className={styles.num}>{plainMoney(line.debit)}</td>
                    <td className={styles.num}>{plainMoney(line.credit)}</td>
                    <td className={styles.num}>{plainMoney(line.runningBalance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalBackdrop} role="presentation">
      <div className={styles.modalPanel} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{title}</div>
          <button type="button" className={styles.iconButton} aria-label="Close" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  pending,
  submitLabel,
  onClose,
  danger = false,
}: {
  pending: boolean;
  submitLabel: string;
  onClose?: () => void;
  danger?: boolean;
}) {
  return (
    <div className={styles.modalFooter}>
      {onClose && (
        <button type="button" className={styles.ghostButton} onClick={onClose} disabled={pending}>
          Cancel
        </button>
      )}
      <button type="submit" className={danger ? styles.dangerButton : styles.button} disabled={pending}>
        {pending && <Loader2 size={15} aria-hidden="true" />}
        {pending ? "Working..." : submitLabel}
      </button>
    </div>
  );
}
