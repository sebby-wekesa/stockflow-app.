import { prisma } from "@/lib/prisma";
import ApprovalTable from "./ApprovalTable";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function OrderApprovalPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/unauthorized");
  }

  const pendingOrders = await prisma.productionOrder.findMany({
    where: { status: "PENDING" },
    include: {
      Design: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Order Approvals</h1>
          <div className="section-sub">Review and approve incoming production orders</div>
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--muted)',
          background: 'var(--surface2)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border2)'
        }}>
          {pendingOrders.length} pending
        </div>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{
            display: 'inline-block',
            marginBottom: '12px'
          }}>
            <div style={{
              padding: '16px',
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius)',
              display: 'inline-block'
            }}>
              <Check size={24} style={{ color: 'var(--muted)' }} />
            </div>
          </div>
          <p style={{
            fontSize: '14px',
            color: 'var(--muted)',
            marginBottom: '4px'
          }}>
            No orders awaiting approval
          </p>
          <p style={{
            fontSize: '12px',
            color: 'var(--muted)'
          }}>
            All orders have been processed
          </p>
        </div>
      ) : (
        <ApprovalTable orders={JSON.parse(JSON.stringify(pendingOrders))} />
      )}
    </div>
  );
}
