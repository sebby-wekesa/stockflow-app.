"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getOperatorQueue,
  getActiveDepartments,
  type OperatorQueueItem,
} from "@/app/actions/production";

export default function OperatorQueuePage() {
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [orders, setOrders] = useState<OperatorQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load available departments on mount
  useEffect(() => {
    const loadDepts = async () => {
      const depts = await getActiveDepartments();
      setDepartments(depts);
      setSelectedDept("");
    };
    loadDepts();
  }, []);

  // Reload jobs when department changes
  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      try {
        const result = await getOperatorQueue(undefined, selectedDept || undefined);
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
    <div className="operator-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Job Queue</div>
          <div className="section-sub">Live production work assigned to your stations</div>
        </div>
        <span className="badge badge-purple">{orders.length} active</span>
      </div>

      <div className="stats-grid operator-stats">
        <div className="stat-card purple">
          <div className="stat-label">Jobs at station</div>
          <div className="stat-value">{orders.length}</div>
          <div className="stat-sub">{selectedDept || "All available work"}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Urgent jobs</div>
          <div className="stat-value">
            {orders.filter((order) => order.priority === "URGENT" || order.priority === "HIGH").length}
          </div>
          <div className="stat-sub">High priority work</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Incoming weight</div>
          <div className="stat-value">
            {orders.reduce((sum, order) => sum + order.inheritedKg, 0).toFixed(1)}
            <span className="stat-suffix">kg</span>
          </div>
          <div className="stat-sub">Available to process</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Select Station</div>
            <div className="section-sub">Show all available work or filter to one station</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedDept("")}
            className={`btn ${selectedDept === "" ? "btn-primary" : "btn-ghost"}`}
          >
            All available
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`btn ${selectedDept === dept ? "btn-primary" : "btn-ghost"}`}
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
          <div>
            <div className="section-title">{selectedDept || "Available Work"} Queue</div>
            <div className="section-sub">Open a job to record production for its current stage</div>
          </div>
          <span className="badge badge-muted">{selectedDept || "All available"}</span>
        </div>

        {loading && <div className="p-6 text-center text-muted">Loading jobs...</div>}

        {!loading && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order) => {
              const isUrgent = order.priority === "URGENT" || order.priority === "HIGH";
              return (
                <Link
                  key={order.id}
                  href={`/operator_log/${order.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className={`operator-job ${isUrgent ? "urgent" : ""}`}>
                    <div className="job-header">
                      <span className="job-id">
                        {order.orderNumber}
                      </span>
                      <span className={`badge ${isUrgent ? "badge-red" : "badge-amber"}`}>
                        {isUrgent ? "Urgent" : "In progress"}
                      </span>
                    </div>
                    <div className="operator-job-body">
                      <div>
                        <div className="job-design">{order.designName}</div>
                        <div className="section-sub">{order.workDescription}</div>
                      </div>
                      <div className="operator-stage">
                        <span>Stage</span>
                        <strong>{order.currentStage}/{order.totalStages}</strong>
                      </div>
                    </div>
                    <div className="job-meta operator-job-meta">
                      <span>
                        Received <span className="job-kg">{order.inheritedKg.toFixed(2)} kg</span>
                      </span>
                      <span>Order target <strong>{order.targetKg.toFixed(2)} kg</strong></span>
                      <span className="operator-open">Open job →</span>
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
