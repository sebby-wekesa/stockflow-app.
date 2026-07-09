import { getAccountingWorkspaceData } from "@/actions/accounting-workspace";
import { AccountingWorkspace } from "@/components/accounting/AccountingWorkspace";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AccountingView = "workspace" | "ledgers" | "reports";

function resolveAccountingView(value: string | string[] | undefined): AccountingView {
  const view = Array.isArray(value) ? value[0] : value;
  return view === "ledgers" || view === "reports" ? view : "workspace";
}

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN", "MANAGER", "ACCOUNTS");
  const data = await getAccountingWorkspaceData();
  const params = await searchParams;

  const initialView = resolveAccountingView(params.view);

  return (
    <AccountingWorkspace
      key={initialView}
      data={data}
      initialView={initialView}
    />
  );
}
