'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getOperatorQueue, getActiveDepartments } from '@/app/actions/production';

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

export default function OperatorQueuePage() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Load available departments that have active work
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const depts = await getActiveDepartments();
        setDepartments(depts.length > 0 ? depts : ['Cutting', 'Bending', 'Welding', 'Assembly']);

        const initialDept = depts[0] || 'Cutting';
        setSelectedDept(initialDept);

        // Try to get current user name (best effort)
        // For now we just show a generic welcome
      } catch (err) {
        setDepartments(['Cutting', 'Bending', 'Welding', 'Assembly']);
        setSelectedDept('Cutting');
      }
      setLoading(false);
    };
    load();
  }, []);

  // Load jobs whenever department changes
  useEffect(() => {
    if (!selectedDept) return;

    const loadJobs = async () => {
      setLoading(true);
      try {
        const result = await getOperatorQueue(undefined, selectedDept);
        setJobs(result || []);
      } catch (err) {
        setJobs([]);
      }
      setLoading(false);
    };

    loadJobs();
  }, [selectedDept]);

  return (
    <div className="mb-24">
      <div className="section-header mb-12">
        <div>
          <div className="section-title">Operator — Job Queue</div>
          <div className="section-sub">
            Select your current department to see available active jobs
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
              className={`btn btn-sm ${selectedDept === dept ? 'btn-primary' : 'btn-secondary'}`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="card">
        <div className="section-header mb-8">
          <div className="section-title">{selectedDept || 'Loading...'} — Active Jobs</div>
          <div className="section-sub">Jobs waiting to be processed at this station</div>
        </div>

        {loading && (
          <div className="p-8 text-center text-muted text-sm">Loading jobs...</div>
        )}

        {!loading && jobs.length > 0 && (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isUrgent = job.priority === 'URGENT' || job.priority === 'HIGH';
              return (
                <Link
                  key={job.id}
                  href={`/operator_log/${job.id}`}
                  className="block"
                >
                  <div className={`job-card ${isUrgent ? 'urgent' : 'inprog'}`}>
                    <div className="job-header">
                      <span className="job-id">
                        {job.orderNumber} · Stage {job.currentStage}/{job.totalStages}
                      </span>
                      <span className={`badge ${isUrgent ? 'badge-red' : 'badge-amber'}`}>
                        {isUrgent ? 'Urgent' : 'Ready'}
                      </span>
                    </div>
                    <div className="job-design">
                      {job.designName} — {job.workDescription}
                    </div>
                    <div className="job-meta" style={{ marginTop: '6px', fontSize: '12px', color: 'var(--muted)' }}>
                      <span>Target: <span className="job-kg">{Number(job.targetKg).toFixed(1)} kg</span></span>
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
      </div>
    </div>
  );
}
