"use client";

import { useState, useEffect, useMemo } from "react";
import { Scale, Trash2, ArrowRightLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";

export function StageLogForm({ order, onComplete }: { order: any, onComplete: () => void }) {
  const { showToast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const department = order.currentDept || order.department || 'Unknown';
  
  const [kgIn] = useState(order.inheritedKg || 0); // Pre-filled from previous stage [cite: 77]
  const [kgOut, setKgOut] = useState<number>(0);
  const [kgScrap, setKgScrap] = useState<number>(0);
  const [scrapReason, setScrapReason] = useState('');

  // Enforce department-specific rules [cite: 55, 56]
  const isValid = useMemo(() => {
    if (department === 'Electroplating') {
      return (Number(kgOut) + Number(kgScrap)) >= kgIn && (kgScrap === 0 || scrapReason);
    } else {
      const totalAccounted = Number(kgOut) + Number(kgScrap);
      const difference = Math.abs(kgIn - totalAccounted);
      return difference < 0.01 && kgOut > 0 && (kgScrap === 0 || scrapReason);
    }
  }, [kgOut, kgScrap, kgIn, scrapReason, department]);

  const handleSubmit = async () => {
    if (!isValid || isSending) return;
    setIsSending(true);

    try {
      const response = await fetch("/api/production/log-stage", {
        method: "POST",
        body: JSON.stringify({
          orderId: order.id,
          stageId: order.currentStageId || order.currentStage,
          kgIn,
          kgOut,
          kgScrap,
          scrapReason,
          department, // Match the Zod schema on backend
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showToast(result.message || "Stage advanced successfully", "success");
        onComplete();
      } else {
        showToast(result.error || "Failed to log stage", "error");
      }
    } catch (error) {
      showToast("Network error: Could not log production stage", "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-[#2a2d32] pb-4">
        <h3 className="font-bold text-[#e8eaed]">Log Production: {order.orderNumber}</h3>
        <span className="px-3 py-1 bg-[#1e2023] rounded-full text-xs font-mono text-[#4a9eff]">
          Target: {order.design.targetDim}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Kg In - Read Only [cite: 77, 139] */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#7a8090] uppercase flex items-center gap-2">
            <Scale size={14} /> Kg Received (In)
          </label>
          <input 
            type="number" 
            value={kgIn} 
            disabled 
            className="w-full bg-[#0f1113] border border-[#2c2d33] rounded-xl p-3 text-[#7a8090] font-mono"
          />
        </div>

        {/* Kg Out - Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#4a9eff] uppercase flex items-center gap-2">
            <ArrowRightLeft size={14} /> Kg Good (Out)
          </label>
          <input 
            type="number" 
            placeholder="0.00"
            onChange={(e) => setKgOut(Number(e.target.value))}
            className="w-full bg-[#1e2023] border border-[#353a40] focus:border-[#4a9eff] outline-none rounded-xl p-3 text-white font-mono"
          />
        </div>

        {/* Kg Scrap - Input [cite: 52, 141] */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#e05555] uppercase flex items-center gap-2">
            <Trash2 size={14} /> Kg Scrap
          </label>
          <input
            type="number"
            placeholder="0.00"
            onChange={(e) => setKgScrap(Number(e.target.value))}
            className="w-full bg-[#1e2023] border border-[#353a40] focus:border-[#e05555] outline-none rounded-xl p-3 text-white font-mono"
          />
        </div>

        {/* Scrap Reason - Select */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#e05555] uppercase">Scrap Reason</label>
          <select
            value={scrapReason}
            onChange={(e) => setScrapReason(e.target.value)}
            className="w-full bg-[#1e2023] border border-[#353a40] focus:border-[#e05555] outline-none rounded-xl p-3 text-white"
          >
            <option value="">Select Reason</option>
            {department === 'Cutting' || department === 'Drilling' ? (
              <>
                <option value="Swarf">Swarf</option>
                <option value="Off-cuts">Off-cuts</option>
              </>
            ) : department === 'Forging' ? (
              <>
                <option value="Scale">Scale</option>
                <option value="Flash">Flash</option>
              </>
            ) : department === 'Electroplating' ? (
              <option value="Coating Defects">Coating Defects</option>
            ) : (
              <option value="General Scrap">General Scrap</option>
            )}
          </select>
        </div>
      </div>

      {/* Logic Validation UI [cite: 56, 78] */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${isValid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
        <p className="text-sm font-medium">
          {isValid ? "✓ Entry Validated" : (department === 'Electroplating' ? "⚠ Error: Output must be >= Input" : "⚠ Error: Total (Out + Scrap) must equal Received (In)")}
        </p>
        <button 
          disabled={!isValid || isSending}
          onClick={handleSubmit}
          className="flex items-center gap-2 bg-[#4a9eff] text-white px-6 py-2 rounded-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#3b8ae6] transition-colors"
        >
          {isSending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {isSending ? "SAVING..." : "COMPLETE STAGE"}
        </button>
      </div>
    </div>
  );
}