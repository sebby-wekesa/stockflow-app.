export const dynamic = 'force-dynamic';

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function OperatorHistoryPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  if (user.role !== "OPERATOR" && user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  // Get completed orders or logs for the user
  const completedOrders = await prisma.productionOrder.findMany({
    where: { status: "COMPLETED" },
    include: { Design: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">My Logs</div>
          <div className="section-sub">
            Completed jobs and history, {user.name || user.email}
          </div>
        </div>
      </div>

      {completedOrders.length === 0 ? (
        <div className="card">
          <p className="text-muted text-sm">No completed jobs yet</p>
        </div>
      ) : (
        <div>
          {completedOrders.map((order) => (
            <div key={order.id} className="job-card completed" style={{ marginBottom: "10px" }}>
              <div className="job-header">
                <span className="job-id">{order.id.slice(0, 8)}</span>
                <span className="badge badge-green">Completed</span>
              </div>
              <div className="job-design">{order.Design.name}</div>
              <div className="job-meta" style={{ marginTop: "8px" }}>
                <span>Target: <span className="job-kg">{order.targetKg.toNumber()} kg</span></span>
                <span>Qty: {order.quantity} units</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
