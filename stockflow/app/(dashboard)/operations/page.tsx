import Link from "next/link";
import { listRoutedOrders, seedLeafSpringRoutes } from "@/actions/operations";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function seedRoutesAction() {
  "use server";
  await seedLeafSpringRoutes();
}

export default async function OperationsPage() {
  await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const orders = await listRoutedOrders();

  return (
    <div className="operations-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Production Operations</div>
          <div className="section-sub">Track leaf springs through automatic FML and HML routes</div>
        </div>
        <form action={seedRoutesAction}>
          <button className="btn btn-ghost" type="submit">Set up / refresh routes</button>
        </form>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Product</th><th>Route</th><th>Progress</th><th>Status</th><th /></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="font-mono">{order.orderNumber}</td>
                  <td>{order.productName ?? "Direct order"}</td>
                  <td><span className="badge badge-amber">{order.routeType}</span></td>
                  <td>{order.operationCount} operations</td>
                  <td>{order.finished ? "Finished" : order.started ? "In progress" : "Not started"}</td>
                  <td><Link className="btn btn-primary btn-sm" href={`/operations/${order.id}`}>{order.operationCount ? "Track" : "Start"}</Link></td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={6} className="sales-empty">No routed production orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
