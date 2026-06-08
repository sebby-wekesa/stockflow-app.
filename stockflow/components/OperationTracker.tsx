"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Play, SkipForward } from "lucide-react";
import {
  finishOperation,
  setOperationSkipped,
  startOperation,
  startOrderRouting,
} from "@/actions/operations";
import { useToast } from "@/components/Toast";

type Operation = {
  id: string;
  name: string;
  sequence: number;
  section: string | null;
  optional: boolean;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED";
  durationSeconds: number | null;
  operatorName: string | null;
};

type TrackerData = {
  order: {
    id: string;
    orderNumber: string;
    productName: string | null;
    routeType: "FML" | "HML" | null;
    status: string;
  };
  operations: Operation[];
  totals: {
    totalActiveSeconds: number;
    elapsedSeconds: number | null;
    completedCount: number;
    totalCount: number;
  };
} | null;

function formatDuration(seconds: number | null) {
  if (seconds == null) return "-";
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${remainder}s`;
}

export function OperationTracker({ data }: { data: TrackerData }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  if (!data) return <div className="card p-6">Order not found.</div>;

  const { order, operations, totals } = data;

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        showToast(result.error ?? "Action failed", "error");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="operations-tracker">
      <div className="card operation-summary">
        <Summary label="Order" value={order.orderNumber} />
        <Summary label="Product" value={order.productName ?? "-"} />
        <Summary label="Route" value={order.routeType ?? "-"} />
        <Summary label="Status" value={order.status} />
        <Summary label="Done" value={`${totals.completedCount}/${totals.totalCount}`} />
        <Summary label="Hands-on" value={formatDuration(totals.totalActiveSeconds)} />
        <Summary label="Elapsed" value={formatDuration(totals.elapsedSeconds)} />
      </div>

      {operations.length === 0 ? (
        <div className="card operation-empty">
          <p>Start the {order.routeType ?? ""} operation flow for this order.</p>
          <button
            className="btn btn-primary"
            disabled={isPending || !order.routeType}
            onClick={() => run(() => startOrderRouting(order.id))}
          >
            Start operation flow
          </button>
        </div>
      ) : (
        <div className="card operation-list">
          {operations.map((operation, index) => {
            const previousSection = operations[index - 1]?.section;
            return (
              <div key={operation.id}>
                {operation.section && operation.section !== previousSection && (
                  <div className="operation-section">
                    {operation.section} <span>optional, use any subset</span>
                  </div>
                )}
                <div className={`operation-row ${operation.status === "SKIPPED" ? "skipped" : ""}`}>
                  <span className="operation-sequence">{operation.sequence}</span>
                  <div className="operation-copy">
                    <strong>{operation.name}</strong>
                    {operation.optional && <span>optional</span>}
                    <small>
                      {operation.status.replace("_", " ")}
                      {operation.durationSeconds != null && (
                        <> · <Clock size={11} /> {formatDuration(operation.durationSeconds)}</>
                      )}
                      {operation.operatorName ? ` · ${operation.operatorName}` : ""}
                    </small>
                  </div>
                  <div className="operation-actions">
                    {operation.status === "PENDING" && (
                      <button className="btn btn-ghost btn-sm" disabled={isPending} onClick={() => run(() => startOperation(operation.id))}>
                        <Play size={13} /> Start
                      </button>
                    )}
                    {operation.status === "IN_PROGRESS" && (
                      <button className="btn btn-primary btn-sm" disabled={isPending} onClick={() => run(() => finishOperation(operation.id))}>
                        <Check size={13} /> Done
                      </button>
                    )}
                    {operation.status === "DONE" && <Check size={17} className="text-teal" />}
                    {operation.optional && operation.status !== "DONE" && operation.status !== "IN_PROGRESS" && (
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={isPending}
                        onClick={() => run(() => setOperationSkipped(operation.id, operation.status !== "SKIPPED"))}
                      >
                        <SkipForward size={13} /> {operation.status === "SKIPPED" ? "Include" : "Skip"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
