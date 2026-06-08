import Link from "next/link";
import { getOrderOperations } from "@/actions/operations";
import { OperationTracker } from "@/components/OperationTracker";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OrderOperationsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const { id } = await params;
  const data = await getOrderOperations(id);

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Operation Tracking</div>
          <Link href="/operations" className="section-sub">Back to operations</Link>
        </div>
      </div>
      <OperationTracker data={data} />
    </div>
  );
}
