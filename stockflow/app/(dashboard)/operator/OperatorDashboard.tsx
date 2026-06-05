"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getOperatorQueue, getActiveDepartments, getOperatorHistory } from "@/app/actions/production";

interface Job {
  id: string;
  orderNumber: string;
  designName: string;
  currentStage: number;
  totalStages: number;
  priority: string;
  targetKg: number;
  workDescription: string;
  inheritedKg: number;
}

interface HistoryItem {
  id: string;
  orderNumber: string;
  designName: string;
  completedAt: string | Date;
  kgIn: number;
  kgOut: number;
  kgScrap: number;
  department: string;
  stageName: string;
}

export default function OperatorDashboard() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load departments
  useEffect(() => {
    const load = async () => {
      try {
        const depts = await getActiveDepartments();
        setDepartments(depts);
        setSelectedDept("");
      } catch {
        setDepartments([]);
        setSelectedDept("");
      }
    };
    load();
  }, []);

  // Load queue when dept changes
  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      try {
        const result = await getOperatorQueue(undefined, selectedDept || undefined);
        setJobs(result || []);
      } catch {
        setJobs([]);
      }
      setLoading(false);
    };
    loadJobs();
  }, [selectedDept]);

  // Load history once
  useEffect(() => {
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const result = await getOperatorHistory();
        setHistory(result || []);
      } catch {
        setHistory([]);
      }
      setLoadingHistory(false);
    };
    loadHistory();
  }, []);

  return (
    <div className="operator-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Operator Dashboard</div>
          <div className="section-sub">
            Live station workload and your recent production output
          </div>
        </div>
        <span className="badge badge-purple">{jobs.length} jobs ready</span>
      </div>

      <div className="stats-grid operator-stats">
        <div className="stat-card purple">
          <div className="stat-label">Current queue</div>
          <div className="stat-value">{jobs.length}</div>
          <div className="stat-sub">{selectedDept || "All available work"}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Urgent work</div>
          <div className="stat-value">{jobs.filter((job) => job.priority === "URGENT" || job.priority === "HIGH").length}</div>
          <div className="stat-sub">High priority jobs</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Recent output</div>
          <div className="stat-value">
            {history.reduce((sum, item) => sum + Number(item.kgOut), 0).toFixed(1)}
            <span className="stat-suffix">kg</span>
          </div>
          <div className="stat-sub">Last {history.length} completed stages</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Current Station</div>
            <div className="section-sub">View all available work or filter by station</div>
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
            <div className="text-sm text-muted">No active departments in the production queue.</div>
          )}
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">{selectedDept || "Available Work"} Queue</div>
            <div className="section-sub">Open a job to record production for its current stage</div>
          </div>
          <Link href="/operator_queue" className="btn btn-ghost btn-sm">View full queue →</Link>
        </div>

        {loading && (
          <div className="p-8 text-center text-muted text-sm">Loading jobs...</div>
        )}

        {!loading && jobs.length > 0 && (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isUrgent = job.priority === "URGENT" || job.priority === "HIGH";
              return (
                <Link key={job.id} href={`/operator_log/${job.id}`} className="block">
                  <div className={`operator-job ${isUrgent ? "urgent" : ""}`}>
                    <div className="job-header">
                      <span className="job-id">
                        {job.orderNumber}
                      </span>
                      <span className={`badge ${isUrgent ? "badge-red" : "badge-amber"}`}>
                        {isUrgent ? "Urgent" : "Ready"}
                      </span>
                    </div>
                    <div className="operator-job-body">
                      <div>
                        <div className="job-design">{job.designName}</div>
                        <div className="section-sub">{job.workDescription}</div>
                      </div>
                      <div className="operator-stage">
                        <span>Stage</span>
                        <strong>{job.currentStage}/{job.totalStages}</strong>
                      </div>
                    </div>
                    <div className="job-meta operator-job-meta">
                      <span>
                        Received <span className="job-kg">{Number(job.inheritedKg).toFixed(1)} kg</span>
                      </span>
                      <span>Order target <strong>{Number(job.targetKg).toFixed(1)} kg</strong></span>
                      <span className="operator-open">Open job →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && jobs.length === 0 && selectedDept && (
          <div className="p-8 text-center">
            <p className="text-muted text-sm">
              No active jobs currently in the <strong>{selectedDept}</strong> department.
            </p>
          </div>
        )}

        {!loading && !selectedDept && (
          <div className="p-8 text-center">
            <p className="text-muted text-sm">No active jobs are currently available.</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">My Recent Output</div>
            <div className="section-sub">Latest stages logged from the production database</div>
          </div>
          <Link href="/operator_history" className="btn btn-ghost btn-sm">View history →</Link>
        </div>

        {loadingHistory && <div className="p-6 text-center text-muted">Loading history...</div>}

        {!loadingHistory && history.length === 0 && (
          <div className="p-8 text-center text-muted text-sm">No completed work logged yet.</div>
        )}

        {!loadingHistory && history.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Design / stage</th><th>Department</th><th>Output</th><th>Scrap</th><th>Completed</th></tr></thead>
              <tbody>
                {history.slice(0, 8).map((item) => (
                  <tr key={item.id}>
                    <td><span className="job-id">{item.orderNumber}</span></td>
                    <td><strong>{item.designName}</strong><div className="section-sub">{item.stageName}</div></td>
                    <td><span className="badge badge-muted">{item.department}</span></td>
                    <td><span className="job-kg">{Number(item.kgOut).toFixed(1)} kg</span></td>
                    <td style={{ color: item.kgScrap > 0 ? "var(--red)" : "var(--muted)" }}>{Number(item.kgScrap).toFixed(1)} kg</td>
                    <td className="section-sub">{new Date(item.completedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
