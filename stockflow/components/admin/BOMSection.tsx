"use client";

import { link, Database, AlertCircle } from "lucide-react";

export function BOMSection({ rawMaterials }: { rawMaterials: any[] }) {
  return (
    <div className="mt-8 p-6 bg-[#0f1113] border border-[#2a2d32] rounded-2xl border-l-4 border-l-[#f0c040]">
      <h3 className="text-sm font-bold text-[#f0c040] uppercase flex items-center gap-2 mb-4">
        <Database size={16} /> Bill of Materials (BOM)
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#7a8090]">Required Raw Material</label>
          <select className="w-full bg-[#1e2023] border border-[#2c2d33] rounded-xl p-3 text-white outline-none">
            <option>Select Material Type...</option>
            {rawMaterials.map(m => (
              <option key={m.id}>{m.materialName} ({m.diameter})</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-[#7a8090]">Consumption Rate (Kg per Unit)</label>
          <div className="relative">
            <input type="number" step="0.001" placeholder="0.125" className="w-full bg-[#1e2023] border border-[#2c2d33] rounded-xl p-3 text-white outline-none" />
            <span className="absolute right-4 top-3 text-[#353a40] font-mono text-sm">kg/unit</span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex items-center gap-2 text-[11px] text-[#7a8090]">
        <AlertCircle size={14} />
        <p>Phase 2: This value will auto-deduct from warehouse stock upon order approval.</p>
      </div>
    </div>
  );
}