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
        setSelectedDept(depts[0] || "");
      } catch {
        setDepartments([]);
        setSelectedDept("");
      }
    };
    load();
  }, []);

  // Load queue when dept changes
  useEffect(() => {
    if (!selectedDept) return;
    const loadJobs = async () => {
      setLoading(true);
      try {
        const result = await getOperatorQueue(undefined, selectedDept);
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
    <div className="mb-24">
      <div className="section-header mb-12">
        <div>
          <div className="section-title">Operator Dashboard</div>
          <div className="section-sub">
            Your station queue, logging, and completed work — all in one place
          </div>
        </div>
      </div>

      {/* Department Chooser */}
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[1px] text-muted mb-2">Choose Department / Station</div>
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
            <div className="text-sm text-muted">No active departments in the production queue.</div>
          )}
        </div>
      </div>

      {/* Active Queue (full featured, matching /operator/queue) */}
      <div className="card mb-10">
        <div className="section-header mb-8">
          <div className="section-title">{selectedDept || "Loading..."} — Active Jobs</div>
          <div className="section-sub">Jobs waiting to be processed at this station. Click to log production.</div>
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
                  <div className={`job-card ${isUrgent ? "urgent" : "inprog"}`}>
                    <div className="job-header">
                      <span className="job-id">
                        {job.orderNumber} · Stage {job.currentStage}/{job.totalStages}
                      </span>
                      <span className={`badge ${isUrgent ? "badge-red" : "badge-amber"}`}>
                        {isUrgent ? "Urgent" : "Ready"}
                      </span>
                    </div>
                    <div className="job-design">
                      {job.designName} — {job.workDescription}
                    </div>
                    <div className="job-meta" style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted)" }}>
                      <span>
                        Target: <span className="job-kg">{Number(job.targetKg).toFixed(1)} kg</span>
                      </span>
                      <span>Received: {Number(job.inheritedKg).toFixed(1)} kg</span>
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

      {/* My History (everything from the dedicated operator history) */}
      <div className="card">
        <div className="section-header mb-8">
          <div className="section-title">My Completed Work</div>
          <div className="section-sub">Recent stages you have logged</div>
        </div>

        {loadingHistory && <div className="p-6 text-center text-muted">Loading history...</div>}

        {!loadingHistory && history.length === 0 && (
          <div className="p-8 text-center text-muted text-sm">No completed work logged yet.</div>
        )}

        {!loadingHistory && history.length > 0 && (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="job-card completed">
                <div className="job-header">
                  <span className="job-id">{item.orderNumber}</span>
                  <span className="badge badge-green">Completed</span>
                </div>
                <div className="job-design">{item.designName} — {item.stageName} ({item.department})</div>
                <div className="job-meta" style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted)" }}>
                  <span>Out: {Number(item.kgOut).toFixed(1)} kg</span>
                  {item.kgScrap > 0 && <span>Scrap: {Number(item.kgScrap).toFixed(1)} kg</span>}
                  <span>{new Date(item.completedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links to full logging/history if needed */}
      <div className="mt-6 text-center text-xs text-muted">
        Full operator tools also available at <Link href="/operator_queue" className="underline">/operator_queue</Link> and <Link href="/operator_history" className="underline">/operator_history</Link>
      </div>
    </div>
  );
}
