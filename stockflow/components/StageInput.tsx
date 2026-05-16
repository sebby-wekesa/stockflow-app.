"use client";

import { useState } from "react";

export function StageInput({ 
  initialStages = ["Cutting", "Forging", "Threading", "Quality Check"] 
}: { initialStages?: string[] }) {
  const [stages, setStages] = useState<string[]>(initialStages);

  const addStage = () => {
    setStages([...stages, ""]);
  };

  const removeStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  const updateStage = (index: number, value: string) => {
    const newStages = [...stages];
    newStages[index] = value;
    setStages(newStages);
  };

  return (
    <div className="space-y-3" id="stages-container">
      {stages.map((stage, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-8 text-sm font-medium text-[#7a8090]">{i + 1}</span>
          <input
            type="text"
            name={`stages[${i}].name`}
            value={stage}
            onChange={(e) => updateStage(i, e.target.value)}
            className="flex-1 bg-[#1e2023] border border-[#2a2d32] rounded-lg p-3 text-[#e8eaed] outline-none focus:border-[#f0c040] transition-all"
            placeholder="Stage name"
          />
          {stages.length > 1 && (
            <button
              type="button"
              onClick={() => removeStage(i)}
              className="text-[#7a8090] hover:text-[#e05555] text-lg font-bold w-6 h-6 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addStage}
        className="text-[#f0c040] hover:text-[#f5d060] transition-all font-medium"
      >
        + Add stage
      </button>
    </div>
  );
}