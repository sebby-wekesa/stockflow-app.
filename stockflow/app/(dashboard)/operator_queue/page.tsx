import { getOperatorQueue } from "@/app/actions/production";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function OperatorQueuePage() {
  const orders = await getOperatorQueue();

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Department — job queue</div>
          <div className="section-sub">Jobs ready for your station</div>
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div className="section-title">Active Jobs</div>
          <div className="section-sub">Jobs assigned to your department</div>
        </div>

        {orders.map((order) => {
          const isUrgent = order.priority === "URGENT" || order.priority === "HIGH";
          return (
            <Link key={order.id} href={`/operator_log?orderId=${order.id}`} style={{textDecoration: 'none', color: 'inherit'}}>
              <div className={`job-card ${isUrgent ? 'urgent' : ''}`} style={{cursor:'pointer', marginBottom: '16px'}}>
                <div className="job-header">
                  <span className="job-id">{order.orderNumber} · Stage {order.currentStage}/{order.totalStages}</span>
                  <span className={`badge ${isUrgent ? 'badge-red' : 'badge-amber'}`}>
                    {isUrgent ? 'Urgent' : 'In progress'}
                  </span>
                </div>
                <div className="job-design">{order.designName} — {order.workDescription}</div>
                <div className="job-meta" style={{marginTop:'8px', display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--muted)'}}>
                  <span>Received: <span className="job-kg">{order.inheritedKg.toFixed(2)} kg</span></span>
                  <span>Target init: {order.targetKg.toFixed(2)} kg</span>
                </div>
              </div>
            </Link>
          )
        })}

        {orders.length === 0 && (
          <div style={{ padding: '20px', color: 'var(--muted)', textAlign: 'center' }}>
            No jobs currently assigned to your department queue.
          </div>
        )}
      </div>
    </div>
  );
}