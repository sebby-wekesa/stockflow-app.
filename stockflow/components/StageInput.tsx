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
          <span className="w-8 text-sm font-medium text-zinc-500">{i + 1}</span>
          <input
            type="text"
            name={`stages[${i}].name`}
            value={stage}
            onChange={(e) => updateStage(i, e.target.value)}
            className="flex-1 px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="Stage name"
          />
          {stages.length > 1 && (
            <button
              type="button"
              onClick={() => removeStage(i)}
              className="text-zinc-400 hover:text-red-600"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addStage}
        className="text-sm text-blue-600 hover:underline"
      >
        + Add Stage
      </button>
    </div>
  );
}