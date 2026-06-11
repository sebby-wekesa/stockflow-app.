import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import type {
  ProductionFlowStage,
  ProductionFlowStatus,
} from "@/lib/production-flow";

const STATUS_CONFIG: Record<
  ProductionFlowStatus,
  { label: string; icon: typeof Circle }
> = {
  PENDING: { label: "Pending", icon: Circle },
  ACTIVE: { label: "Active", icon: LoaderCircle },
  COMPLETED: { label: "Completed", icon: CheckCircle2 },
  BLOCKED: { label: "Blocked", icon: AlertTriangle },
  REJECTED: { label: "Rejected", icon: XCircle },
};

function formatKg(value: number | null) {
  return value == null
    ? "-"
    : `${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })} kg`;
}

function formatTimestamp(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ProductionFlowDiagram({ stages }: { stages: ProductionFlowStage[] }) {
  return (
    <div className="production-flow-scroll">
      <div className="production-flow-diagram">
        {stages.map((stage, index) => {
          const config = STATUS_CONFIG[stage.status];
          const StatusIcon = config.icon;

          return (
            <div className="production-flow-step" key={stage.key}>
              <article className={`production-flow-node status-${stage.status.toLowerCase()}`}>
                <div className="production-flow-node-header">
                  <StatusIcon
                    aria-hidden="true"
                    className={stage.status === "ACTIVE" ? "production-flow-spin" : undefined}
                    size={18}
                  />
                  <div>
                    <strong>{stage.name}</strong>
                    <span>{stage.department}</span>
                  </div>
                </div>

                <div className="production-flow-status">{config.label}</div>

                <dl className="production-flow-metrics">
                  <div><dt>Kg In</dt><dd>{formatKg(stage.kgIn)}</dd></div>
                  <div><dt>Kg Out</dt><dd>{formatKg(stage.kgOut)}</dd></div>
                  <div><dt>Kg Scrap</dt><dd>{formatKg(stage.kgScrap)}</dd></div>
                </dl>

                <dl className="production-flow-meta">
                  <div><dt>Assigned Operator</dt><dd>{stage.assignedOperator ?? "-"}</dd></div>
                  <div><dt>Completed</dt><dd>{formatTimestamp(stage.completedAt)}</dd></div>
                </dl>
              </article>

              {index < stages.length - 1 && (
                <ArrowRight aria-hidden="true" className="production-flow-arrow" size={20} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
