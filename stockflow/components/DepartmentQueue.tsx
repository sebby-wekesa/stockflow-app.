"use client";

import { Clock, Box, Scale, ChevronRight, Hash } from "lucide-react";
import { useState, useEffect } from "react";
import { StageLogForm } from './operator/StageLogForm';

// Define proper TypeScript interfaces
interface ProductionOrder {
  id: string;
  orderNumber: string;
  design: {
    name: string;
  };
  inheritedKg: number;
  targetKg: number;
  currentStage: number;
  status: string;
}

interface DepartmentQueueProps {
  userDept: string;
}

export function DepartmentQueue({ userDept }: DepartmentQueueProps) {
  const [jobs, setJobs] = useState<ProductionOrder[]>([]);
  const [activeJob, setActiveJob] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const response = await fetch(`/api/production-orders?dept=${userDept}&status=IN_PRODUCTION`);
      if (response.ok) {
        const result = await response.json();
        // Transform API response to match our interface
        const transformedJobs = result.data.map((order: any) => ({
          id: order.id,
          orderNumber: order.code,
          design: { 
            name: order.designName, 
            targetDim: order.targetDimensions || "Standard" 
          },
          inheritedKg: order.targetKg,
          targetKg: order.targetKg,
          currentStage: order.currentStage || 1,
          status: order.status,
          currentStageId: order.currentStageId,
          currentDept: order.currentDept,
        }));
        setJobs(transformedJobs);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userDept) {
      fetchJobs();
    }
  }, [userDept]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center py-8">
          <div className="text-[#7a8090]">Loading jobs...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight">{userDept} Queue</h2>
          <p className="text-sm text-[#7a8090]">Active jobs assigned to your station</p>
        </div>
        <div className="bg-[#1e2023] border border-[#2a2d32] px-4 py-2 rounded-xl">
          <span className="text-xs font-bold text-[#7a8090] mr-2">LOAD:</span>
          <span className="text-sm font-mono text-[#4a9eff]">{jobs.length} Jobs</span>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-8 text-[#7a8090]">
          No active jobs in queue
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map((job) => (
          <div 
            key={job.id} 
            className="group bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 hover:border-[#4a9eff]/50 transition-all flex flex-col md:flex-row justify-between items-center gap-6"
          >
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="p-4 bg-[#1e2023] rounded-xl text-[#4a9eff] group-hover:scale-110 transition-transform">
                <Box size={24} />
              </div>
              <div>
                <h3 className="font-bold text-[#e8eaed] text-lg">{job.design.name}</h3>
                <div className="flex gap-4 mt-1">
                  <span className="text-xs text-[#7a8090] flex items-center gap-1">
                    <Clock size={12} /> Received 2h ago
                  </span>
                  <span className="text-xs text-[#7a8090] flex items-center gap-1">
                    <Hash size={12} /> {job.orderNumber}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
              <div className="text-right">
                <p className="text-[10px] font-bold text-[#7a8090] uppercase mb-1">Incoming Weight</p>
                <div className="flex items-center gap-2 text-xl font-mono font-bold text-white">
                  <Scale size={18} className="text-[#4a9eff]" />
                  {job.inheritedKg} <span className="text-xs font-normal opacity-50">kg</span>
                </div>
              </div>
              
              <button 
                onClick={() => setActiveJob(job)}
                className="bg-[#1e2023] border border-[#2c2d33] hover:bg-[#4a9eff] hover:text-white text-[#4a9eff] px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
              >
                LOG PRODUCTION <ChevronRight size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* When a job is clicked, show the StageLogForm we built earlier */}
      {activeJob && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="max-w-2xl w-full">
             <button onClick={() => setActiveJob(null)} className="text-white mb-2 text-sm hover:underline">← Back to Queue</button>
             {/* Component from previous step */}
              <StageLogForm
                order={activeJob}
                onComplete={() => {
                  setActiveJob(null);
                  // Refresh the jobs list
                  fetchJobs();
                }}
              />
           </div>
        </div>
      )}
    </div>
  );
}