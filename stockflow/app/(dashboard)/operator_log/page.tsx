"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getActiveDepartments,
  getOperatorQueue,
  type OperatorQueueItem,
} from "@/app/actions/production";

export default function OperatorLogIndexPage() {
  const [selectedDept, setSelectedDept] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [orders, setOrders] = useState<OperatorQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDepartments() {
      try {
        const activeDepartments = await getActiveDepartments();
        setDepartments(activeDepartments);
        setSelectedDept("");
      } catch {
        setDepartments([]);
        setSelectedDept("");
        setOrders([]);
        setLoading(false);
      }
    }

    loadDepartments();
  }, []);

  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      try {
        const result = await getOperatorQueue(undefined, selectedDept || undefined);
        setOrders(result);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }

    loadJobs();
  }, [selectedDept]);

  return (
    <div className="operator-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Stage Logging</div>
          <div className="section-sub">Select a job assigned to your department and record kg received, output, and scrap</div>
        </div>
        <span className="badge badge-purple">{orders.length} ready</span>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Department</div>
            <div className="section-sub">Show all available work or filter to one department</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedDept("")}
            className={`btn ${selectedDept === "" ? "btn-primary" : "btn-ghost"}`}
          >
            All available
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              className={`btn ${selectedDept === dept ? "btn-primary" : "btn-ghost"}`}
            >
              {dept}
            </button>
          ))}
          {departments.length === 0 && (
            <div className="text-sm text-muted">No active stage logging work is available right now.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">{selectedDept || "Available Work"} Jobs</div>
            <div className="section-sub">Open a job to complete its current production stage</div>
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
                      <span className="job-id">{order.orderNumber}</span>
                      <span className={`badge ${isUrgent ? "badge-red" : "badge-amber"}`}>
                        {isUrgent ? "Urgent" : "Ready to log"}
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
                      <span className="operator-open">Log stage →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div style={{ padding: "20px", color: "var(--muted)", textAlign: "center" }}>
            {selectedDept
              ? <>No active jobs in the <strong>{selectedDept}</strong> department right now.</>
              : "No active jobs are currently available."}
          </div>
        )}
      </div>
    </div>
  );
}
