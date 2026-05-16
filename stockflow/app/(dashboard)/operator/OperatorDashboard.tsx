"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getOperatorData } from "./actions";
import { DepartmentQueue } from "@/components/DepartmentQueue";
import { Factory, Terminal, Activity, Info } from "lucide-react";

export default function OperatorDashboard() {
  const [designs, setDesigns] = useState<any[]>([]);

  // In a real scenario, this comes from the logged-in user's profile
  const userDept = "Cutting";

  useEffect(() => {
    const fetchData = async () => {
      const result = await getOperatorData();
      if (result.success && result.data) {
        setDesigns(result.data);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Operator — {userDept} Department</div><div className="section-sub">Process jobs and log production output</div></div>
      </div>

      {/* Dashboard Stats */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-label">Jobs in queue</div>
          <div className="stat-value">3</div>
          <div className="stat-sub">Ready for processing</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Today's output</div>
          <div className="stat-value">340<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
          <div className="stat-sub">Processed so far</div>
        </div>
      </div>

      {/* Active Queue */}
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Job queue</div><div className="section-sub">Jobs ready for your department</div></div>
        <DepartmentQueue userDept={userDept} />
      </div>

      {/* Log Output */}
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Log output</div><Link href="/operator_log" className="btn btn-ghost btn-sm">View full log</Link></div>
        <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'18px'}}>
          <div style={{fontSize:'13px',fontWeight:'600',marginBottom:'4px'}}>No active job</div>
          <div style={{fontSize:'12px',color:'var(--muted)',marginBottom:'14px'}}>Select a job from the queue above to begin logging output</div>
          <button className="btn btn-primary">Start new job</button>
        </div>
      </div>

      {/* Operational Tip */}
      <div style={{
        background: 'rgba(74,158,255,0.1)',
        border: '1px solid rgba(74,158,255,0.2)',
        borderRadius: 'var(--radius)',
        padding: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <div style={{
          padding: '6px',
          background: 'rgba(74,158,255,0.2)',
          borderRadius: 'var(--radius-sm)'
        }}>
          <Info style={{ color: 'var(--blue)' }} size={16} />
        </div>
        <div>
          <h4 style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--blue)',
            fontFamily: 'var(--font-head)',
            marginBottom: '4px'
          }}>
            Station Tip
          </h4>
          <p style={{
            fontSize: '13px',
            color: 'var(--text)',
            lineHeight: 1.5
          }}>
            Ensure all material weights are logged before completing a stage. Accurate "Kg Out" values
            automatically update the target weight for the next department in the sequence.
          </p>
        </div>
      </div>
    </div>
  );
}