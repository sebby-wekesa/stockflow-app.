import { getAccountingWorkspaceData } from "@/actions/accounting-workspace";
import { AccountingWorkspace } from "@/components/accounting/AccountingWorkspace";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AccountingView = "overview" | "workspace" | "ledgers" | "reports";
type AccountingPostTab = "cash-book" | "revenue" | "purchases" | "payroll";

function resolveAccountingView(value: string | string[] | undefined): AccountingView {
  const view = Array.isArray(value) ? value[0] : value;
  return view === "workspace" || view === "ledgers" || view === "reports"
    ? view
    : "overview";
}

function resolveAccountingPostTab(value: string | string[] | undefined): AccountingPostTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "revenue" || tab === "purchases" || tab === "payroll"
    ? tab
    : "cash-book";
}

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const accountingData = await getAccountingWorkspaceData();
  const params = await searchParams;

  const initialView = resolveAccountingView(params.view);
  const initialPostTab = resolveAccountingPostTab(params.tab);

  return (
    <AccountingWorkspace
      key={`${initialView}-${initialPostTab}`}
      data={accountingData}
      initialView={initialView}
      initialPostTab={initialPostTab}
    />
  );
}
