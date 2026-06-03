"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getOperatorQueue, getActiveDepartments } from "@/app/actions/production";

export default function OperatorQueuePage() {
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]); // TODO: proper type from production action
  const [loading, setLoading] = useState(true);

  // Load available departments on mount
  useEffect(() => {
    const loadDepts = async () => {
      const depts = await getActiveDepartments();
      setDepartments(depts);
      // Default to first one (usually user's dept or most active)
      const initial = depts[0] || "";
      setSelectedDept(initial);
    };
    loadDepts();
  }, []);

  // Reload jobs when department changes
  useEffect(() => {
    if (!selectedDept) return;

    const loadJobs = async () => {
      setLoading(true);
      try {
        const result = await getOperatorQueue(undefined, selectedDept);
        setOrders(result);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, [selectedDept]);

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Department Queue</div>
          <div className="section-sub">Choose your current station to see available active jobs</div>
        </div>
      </div>

      {/* Department Chooser */}
      <div className="mb-8">
        <div className="section-header mb-3">
          <div className="section-title text-sm">Select Department / Station</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`btn btn-sm ${selectedDept === dept ? "btn-primary" : "btn-secondary"}`}
            >
              {dept}
            </button>
          ))}
          {departments.length === 0 && (
            <div className="text-sm text-muted">No active departments with jobs right now.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div className="section-title">Active Jobs — {selectedDept || "Loading..."}</div>
          <div className="section-sub">Jobs currently waiting at this department</div>
        </div>

        {loading && <div className="p-6 text-center text-muted">Loading jobs...</div>}

        {!loading && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order) => {
              const isUrgent = order.priority === "URGENT" || order.priority === "HIGH";
              return (
                <Link
                  key={order.id}
                  href={`/operator_log?orderId=${order.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className={`job-card ${isUrgent ? "urgent" : ""}`} style={{ cursor: "pointer" }}>
                    <div className="job-header">
                      <span className="job-id">
                        {order.orderNumber} · Stage {order.currentStage}/{order.totalStages}
                      </span>
                      <span className={`badge ${isUrgent ? "badge-red" : "badge-amber"}`}>
                        {isUrgent ? "Urgent" : "In progress"}
                      </span>
                    </div>
                    <div className="job-design">
                      {order.designName} — {order.workDescription}
                    </div>
                    <div className="job-meta" style={{ marginTop: "8px", display: "flex", gap: "16px", fontSize: "12px", color: "var(--muted)" }}>
                      <span>
                        Received: <span className="job-kg">{order.inheritedKg.toFixed(2)} kg</span>
                      </span>
                      <span>Target: {order.targetKg.toFixed(2)} kg</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && orders.length === 0 && selectedDept && (
          <div style={{ padding: "20px", color: "var(--muted)", textAlign: "center" }}>
            No active jobs in the <strong>{selectedDept}</strong> department right now.
          </div>
        )}

        {!loading && orders.length === 0 && !selectedDept && (
          <div style={{ padding: "20px", color: "var(--muted)", textAlign: "center" }}>
            No active jobs are currently available.
          </div>
        )}
      </div>
    </div>
  );
}
