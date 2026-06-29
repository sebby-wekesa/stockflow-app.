import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  Flag,
  PackageCheck,
  PlayCircle,
  RefreshCcw,
  ShoppingCart,
} from "lucide-react";
import {
  advanceDemoFlow,
  getDemoFlowSnapshot,
  resetDemoFlow,
  startDemoFlow,
  type DemoFlowPhase,
} from "@/actions/demo-flow";
import { ProductionFlowDiagram } from "@/components/ProductionFlowDiagram";
import { formatKES } from "@/lib/sales-utils";

export const dynamic = "force-dynamic";

const PHASE_ICONS = {
  sales: ShoppingCart,
  request: ClipboardCheck,
  stages: Factory,
  packaging: PackageCheck,
  fulfilled: Flag,
};

function formatStatus(value: string | null) {
  if (!value) return "Not started";
  return value.replaceAll("_", " ");
}

function PhaseCard({ phase }: { phase: DemoFlowPhase }) {
  const Icon = PHASE_ICONS[phase.key as keyof typeof PHASE_ICONS] ?? CheckCircle2;

  return (
    <div className={`demo-phase-card ${phase.status.toLowerCase()}`}>
      <div className="demo-phase-icon">
        <Icon aria-hidden="true" size={17} />
      </div>
      <div className="demo-phase-copy">
        <strong>{phase.label}</strong>
        <span>{phase.detail}</span>
      </div>
      <span className="demo-phase-state">{phase.status.toLowerCase()}</span>
    </div>
  );
}

export default async function DemoFlowPage() {
  const snapshot = await getDemoFlowSnapshot();
  const progressPct = snapshot.totalStages > 0
    ? Math.round((snapshot.completedStages / snapshot.totalStages) * 100)
    : 0;

  return (
    <div className="demo-flow-page">
      <div className="demo-flow-hero">
        <div className="demo-flow-hero-copy">
          <span className="demo-flow-kicker">Guided workflow demo</span>
          <h1>Sales order to fulfilled dispatch</h1>
          <p>
            One linked customer order moving through production request, operator stages,
            packaging, and final fulfillment.
          </p>
        </div>
        <div className="demo-flow-action-panel">
          <div>
            <span className="form-label">Current handoff</span>
            <strong>{snapshot.currentHandoff}</strong>
            <p>{snapshot.nextActionDetail}</p>
          </div>
          <div className="demo-flow-actions">
            {snapshot.isComplete ? (
              <div className="demo-flow-complete-pill">
                <CheckCircle2 aria-hidden="true" size={15} />
                Flow fulfilled
              </div>
            ) : (
              <form action={snapshot.exists ? advanceDemoFlow : startDemoFlow}>
                <button className="btn btn-primary demo-primary-action" type="submit">
                  <PlayCircle aria-hidden="true" size={15} />
                  {snapshot.nextActionLabel}
                </button>
              </form>
            )}
            <form action={resetDemoFlow}>
              <button className="btn btn-ghost demo-secondary-action" disabled={!snapshot.exists} type="submit">
                <RefreshCcw aria-hidden="true" size={14} />
                Replay from sales
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="demo-phase-rail" aria-label="Demo workflow phases">
        {snapshot.phases.map((phase, index) => (
          <div className="demo-phase-segment" key={phase.key}>
            <PhaseCard phase={phase} />
            {index < snapshot.phases.length - 1 && (
              <ArrowRight aria-hidden="true" className="demo-phase-arrow" size={18} />
            )}
          </div>
        ))}
      </div>

      <div className="stats-grid demo-flow-stats">
        <div className="stat-card amber">
          <div className="stat-label">Sales order</div>
          <div className="stat-value demo-flow-status">{formatStatus(snapshot.saleStatus)}</div>
          <div className="stat-sub">{snapshot.customerName}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Production request</div>
          <div className="stat-value demo-flow-status">{formatStatus(snapshot.productionStatus)}</div>
          <div className="stat-sub">{snapshot.productionOrderNumber ?? "Pending demo start"}</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Stage progress</div>
          <div className="stat-value">{progressPct}<span className="stat-suffix">%</span></div>
          <div className="stat-sub">{snapshot.completedStages}/{snapshot.totalStages || 10} workflow steps complete</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Order value</div>
          <div className="stat-value demo-flow-money">{formatKES(snapshot.totalAmount)}</div>
          <div className="stat-sub">{snapshot.quantity.toLocaleString()} pcs/sets requested</div>
        </div>
      </div>

      <div className="grid-2 demo-flow-grid mb-16">
        <section className="demo-flow-panel">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">Demo Records</div>
              <div className="section-sub">Tenant-scoped records created for this guided flow</div>
            </div>
          </div>
          <div className="demo-record-list">
            <div className="demo-record-row">
              <span>Customer</span>
              <strong>{snapshot.customerName}</strong>
            </div>
            <div className="demo-record-row">
              <span>Product</span>
              <strong>{snapshot.productName}</strong>
            </div>
            <div className="demo-record-row">
              <span>Production weight</span>
              <strong>{snapshot.finishedKg == null ? `${snapshot.targetKg.toFixed(1)} kg target` : `${snapshot.finishedKg.toFixed(1)} kg finished`}</strong>
            </div>
            <div className="demo-record-row">
              <span>Sales order</span>
              {snapshot.saleOrderId ? (
                <Link href={`/sales/${snapshot.saleOrderId}`}>{snapshot.saleOrderId}</Link>
              ) : (
                <strong>Not created</strong>
              )}
            </div>
            <div className="demo-record-row">
              <span>Production order</span>
              {snapshot.productionOrderId ? (
                <Link href={`/jobs/${snapshot.productionOrderId}`}>{snapshot.productionOrderNumber}</Link>
              ) : (
                <strong>Not created</strong>
              )}
            </div>
          </div>
        </section>

        <section className="demo-flow-panel">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">Next Handoff</div>
              <div className="section-sub">The next state transition in the demo thread</div>
            </div>
            {snapshot.exists && (
              <span className={`badge ${snapshot.isComplete ? "badge-teal" : "badge-amber"}`}>
                {snapshot.isComplete ? "Fulfilled" : "In progress"}
              </span>
            )}
          </div>
          <div className="demo-handoff-block">
            <span>{snapshot.nextActionLabel}</span>
            <strong>{snapshot.currentHandoff}</strong>
            <p>{snapshot.nextActionDetail}</p>
          </div>
          <div className="demo-flow-links">
            <Link className="btn btn-ghost btn-sm" href="/operations">Operations board</Link>
            <Link className="btn btn-ghost btn-sm" href="/packaging">Packaging queue</Link>
            <Link className="btn btn-ghost btn-sm" href="/sales">Sales orders</Link>
          </div>
        </section>
      </div>

      {snapshot.exists ? (
        <section className="card production-flow-order demo-flow-diagram-card">
          <div className="production-flow-order-header">
            <div>
              <div className="production-flow-order-title">
                <span className="font-mono">{snapshot.productionOrderNumber}</span>
                <span>{snapshot.productName}</span>
              </div>
              <div className="production-flow-order-meta">
                <span className="badge badge-muted">{formatStatus(snapshot.productionStatus)}</span>
                <span>{snapshot.completedStages}/{snapshot.totalStages} workflow steps</span>
              </div>
            </div>
          </div>
          <ProductionFlowDiagram
            interactive={false}
            orderId={snapshot.productionOrderId!}
            stages={snapshot.stages}
          />
        </section>
      ) : (
        <section className="demo-flow-empty">
          <Factory aria-hidden="true" size={34} />
          <strong>No demo flow has been started</strong>
          <span>Start the demo to create the linked sales and production records.</span>
        </section>
      )}
    </div>
  );
}
