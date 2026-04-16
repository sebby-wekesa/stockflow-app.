"use client";

import { Settings, Layers, Anchor, Save } from "lucide-react";
import { useState } from "react";

export function DesignTemplateForm() {
  const [stages, setStages] = useState([{ dept: "Cutting", order: 1 }]);

  const addStage = () => {
    setStages([...stages, { dept: "", order: stages.length + 1 }]);
  };

  return (
    <div className="max-w-3xl bg-[#161719] border border-[#2a2d32] rounded-2xl p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="text-[#8b7cf8]" /> Create Design Template
          </h2>
          <p className="text-sm text-[#7a8090]">Define the production sequence and specs for a product.</p>
        </div>
        <div className="px-4 py-2 bg-[#8b7cf8]/10 border border-[#8b7cf8]/20 rounded-lg text-[#8b7cf8] text-xs font-bold">
          PHASE 1 CORE
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#7a8090] uppercase">Template Name</label>
            <input placeholder="e.g. Hex Bolt M12 x 80mm" className="w-full bg-[#1e2023] border border-[#2c2d33] rounded-xl p-3 text-white outline-none focus:border-[#8b7cf8]" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#7a8090] uppercase">Target Kg per 100 Units</label>
            <input type="number" placeholder="12.5" className="w-full bg-[#1e2023] border border-[#2c2d33] rounded-xl p-3 text-white outline-none focus:border-[#8b7cf8]" />
          </div>
        </div>

        {/* Dynamic Stages List */}
        <div className="space-y-4">
          <label className="text-xs font-bold text-[#7a8090] uppercase flex items-center gap-2">
            <Layers size={14} /> Production Sequence
          </label>

          {stages.map((stage, index) => (
            <div key={index} className="flex items-center gap-4 bg-[#0f1113] p-4 rounded-xl border border-[#2a2d32] group">
              <span className="w-8 h-8 rounded-full bg-[#1e2023] flex items-center justify-center text-xs font-bold text-[#7a8090]">
                {index + 1}
              </span>
              <select className="flex-1 bg-transparent text-white outline-none">
                <option>Select Department...</option>
                <option>Cutting</option>
                <option>Forging</option>
                <option>Threading</option>
                <option>Electroplating</option>
              </select>
              <Anchor size={16} className="text-[#353a40] group-hover:text-[#8b7cf8] transition-colors" />
            </div>
          ))}

          <button
            onClick={addStage}
            className="w-full py-3 border border-dashed border-[#353a40] rounded-xl text-[#7a8090] text-sm hover:border-[#8b7cf8] hover:text-[#8b7cf8] transition-all"
          >
            + Add Next Department in Sequence
          </button>
        </div>

        <button className="w-full bg-[#8b7cf8] hover:bg-[#7a6ce5] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 mt-4 shadow-lg shadow-[#8b7cf8]/10">
          <Save size={20} /> SAVE DESIGN TEMPLATE
        </button>
      </div>
    </div>
  );
}