"use client";

import { useState, useEffect } from "react";
import { getOperatorData } from "./actions";
import OperatorQueue from "@/components/production/OperatorQueue";
import { Factory, Terminal, Activity, Info } from "lucide-react";

export default function OperatorPage() {
  const [designs, setDesigns] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  // In a real scenario, this comes from the logged-in user's profile
  const userDept = "Cutting";

  const fetchJobs = async () => {
    try {
      const response = await fetch(`/api/production-orders?dept=${userDept}&status=IN_PRODUCTION`);
      if (response.ok) {
        const result = await response.json();
        // Transform to match Job interface
        const transformedJobs = result.data.map((order: any) => ({
          id: order.id,
          orderNumber: order.code,
          design: {
            name: order.designName,
            targetDimensions: order.targetDimensions,
          },
          currentStage: order.currentStage,
          targetKg: order.targetKg,
          priority: order.priority,
        }));
        setJobs(transformedJobs);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  }; 

  useEffect(() => {
    const fetchData = async () => {
      const result = await getOperatorData();
      if (result.success) {
        setDesigns(result.data);
      }
    };
    fetchData();
    fetchJobs();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ── Terminal Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Terminal className="text-[#4a9eff]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#e8eaed] flex items-center gap-2">
              Station Terminal: <span className="text-[#4a9eff]">{userDept}</span>
            </h1>
            <p className="text-sm text-[#7a8090]">
              Process active jobs | <span className="text-[#4a9eff]">{designs.length} Products</span> in Registry
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-[#1e2023] rounded-lg border border-[#353a40] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-[#7a8090] uppercase tracking-wider">System Online</span>
          </div>
        </div>
      </div>

      {/* ── Dashboard Stats (Mini) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#161719] border border-[#2a2d32] rounded-xl p-4 flex items-center gap-4">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Activity className="text-purple-400" size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#7a8090] uppercase">Station Efficiency</div>
            <div className="text-lg font-bold text-[#e8eaed]">98.2%</div>
          </div>
        </div>
        <div className="bg-[#161719] border border-[#2a2d32] rounded-xl p-4 flex items-center gap-4">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Factory className="text-blue-400" size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#7a8090] uppercase">Queue Health</div>
            <div className="text-lg font-bold text-[#e8eaed]">Optimal</div>
          </div>
        </div>
        <div className="bg-[#161719] border border-[#2a2d32] rounded-xl p-4 flex items-center gap-4">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Info className="text-amber-400" size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#7a8090] uppercase">Pending Handoffs</div>
            <div className="text-lg font-bold text-[#e8eaed]">Live Sync</div>
          </div>
        </div>
      </div>

      {/* ── Active Queue ── */}
      <section className="bg-[#161719] border border-[#2a2d32] rounded-2xl overflow-hidden min-h-[400px]">
        <div className="p-6 border-b border-[#2a2d32] flex items-center justify-between bg-gradient-to-r from-blue-500/5 to-transparent">
          <div>
            <h2 className="text-lg font-bold text-[#e8eaed]">Active Production Queue</h2>
            <p className="text-sm text-[#7a8090]">Orders currently staged for {userDept}</p>
          </div>
        </div>
        
        <div className="p-6">
          <OperatorQueue jobs={jobs} operatorDept={userDept} onJobComplete={fetchJobs} />
        </div>
      </section>

      {/* ── Operational Tip ── */}
      <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-4">
        <div className="p-1.5 bg-blue-500/20 rounded-md mt-0.5">
          <Info className="text-blue-400" size={16} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-blue-400 mb-1">Station Tip</h4>
          <p className="text-xs text-blue-300/80 leading-relaxed">
            Ensure all material weights are logged before completing a stage. Accurate &ldquo;Kg Out&rdquo; values 
            automatically update the target weight for the next department in the sequence.
          </p>
        </div>
      </div>

    </div>
  );
}
