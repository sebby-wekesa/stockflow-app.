import Link from "next/link";
import { listProductionOrderFlows, seedLeafSpringRoutes } from "@/actions/operations";
import { ProductionFlowDiagram } from "@/components/ProductionFlowDiagram";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function seedRoutesAction() {
  "use server";
  await seedLeafSpringRoutes();
}

export default async function OperationsPage() {
  await requireRole("ADMIN", "MANAGER", "OPERATOR");
  const orders = await listProductionOrderFlows();

  return (
    <div className="operations-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Production Operations</div>
          <div className="section-sub">Follow every production order from sales through packaging</div>
        </div>
        <form action={seedRoutesAction}>
          <button className="btn btn-ghost" type="submit">Set up / refresh routes</button>
        </form>
      </div>

      <div className="production-flow-orders">
        {orders.map((order) => (
          <section className="card production-flow-order" key={order.id}>
            <div className="production-flow-order-header">
              <div>
                <div className="production-flow-order-title">
                  <span className="font-mono">{order.orderNumber}</span>
                  <span>{order.productName}</span>
                </div>
                <div className="production-flow-order-meta">
                  <span className="badge badge-muted">{order.status.replaceAll("_", " ")}</span>
                  {order.routeType && <span className="badge badge-amber">{order.routeType}</span>}
                  <span>{order.operationCount} routed operations</span>
                </div>
              </div>
              <Link className="btn btn-ghost btn-sm" href={`/operations/${order.id}`}>
                Open operation tracker
              </Link>
            </div>
            <ProductionFlowDiagram stages={order.stages} />
          </section>
        ))}

        {orders.length === 0 && (
          <div className="card operation-empty">
            <p>No production orders yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
