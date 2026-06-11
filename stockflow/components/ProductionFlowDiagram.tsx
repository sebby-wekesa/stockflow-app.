"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import { completeProductionFlowStage } from "@/actions/operations";
import { useToast } from "@/components/Toast";
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

const SCRAP_REASONS = [
  ["", "Select reason"],
  ["MACHINE_FAULT", "Machine fault"],
  ["MATERIAL_DEFECT", "Material defect"],
  ["HUMAN_ERROR", "Human error"],
  ["PROCESS_LOSS", "Process loss"],
] as const;

export function ProductionFlowDiagram({
  orderId,
  stages,
}: {
  orderId: string;
  stages: ProductionFlowStage[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedStage, setSelectedStage] = useState<ProductionFlowStage | null>(null);
  const [isPending, startTransition] = useTransition();

  function completeStage(formData: FormData) {
    if (!selectedStage) return;
    startTransition(async () => {
      const result = await completeProductionFlowStage({
        orderId,
        stageKey: selectedStage.key,
        kgIn: Number(formData.get("kgIn")),
        kgOut: Number(formData.get("kgOut")),
        kgScrap: Number(formData.get("kgScrap")),
        scrapReason: String(formData.get("scrapReason") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });
      if (!result.success) {
        showToast(result.error ?? "Failed to complete stage", "error");
        return;
      }
      showToast(`${result.completedStage} completed`, "success");
      setSelectedStage(null);
      router.refresh();
    });
  }

  return (
    <>
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

                  {stage.canComplete && (
                    <button
                      className="btn btn-primary btn-sm production-flow-complete"
                      onClick={() => setSelectedStage(stage)}
                      type="button"
                    >
                      <CheckCircle2 size={13} /> Mark complete
                    </button>
                  )}
                </article>

                {index < stages.length - 1 && (
                  <ArrowRight aria-hidden="true" className="production-flow-arrow" size={20} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedStage && (
        <div className="production-flow-modal-backdrop" onClick={() => setSelectedStage(null)}>
          <div className="card production-flow-modal" onClick={(event) => event.stopPropagation()}>
            <div className="production-flow-modal-header">
              <div>
                <div className="section-title">Complete {selectedStage.name}</div>
                <div className="section-sub">Record output before moving to the next stage</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedStage(null)} type="button">
                <XCircle size={14} /> Close
              </button>
            </div>

            <form action={completeStage} className="production-flow-form">
              <div className="form-row">
                <label className="form-group">
                  <span className="form-label">Kg In</span>
                  <input
                    className="form-input"
                    defaultValue={selectedStage.kgIn ?? ""}
                    min="0"
                    name="kgIn"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Kg Out</span>
                  <input className="form-input" min="0" name="kgOut" required step="0.01" type="number" />
                </label>
              </div>
              <div className="form-row">
                <label className="form-group">
                  <span className="form-label">Kg Scrap</span>
                  <input className="form-input" defaultValue="0" min="0" name="kgScrap" required step="0.01" type="number" />
                </label>
                <label className="form-group">
                  <span className="form-label">Scrap Reason</span>
                  <select className="form-input" defaultValue="" name="scrapReason">
                    {SCRAP_REASONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedStage.key !== "electroplating" && (
                <div className="production-flow-balance-note">Kg In must equal Kg Out plus Kg Scrap.</div>
              )}
              <label className="form-group">
                <span className="form-label">Notes</span>
                <textarea className="form-input" name="notes" rows={3} />
              </label>
              <button className="btn btn-primary" disabled={isPending} type="submit">
                <CheckCircle2 size={14} /> {isPending ? "Completing..." : "Complete stage"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
