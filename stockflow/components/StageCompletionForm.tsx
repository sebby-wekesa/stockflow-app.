"use client";

import { useState, useTransition } from "react";
import { completeStage } from "@/actions/stage-completion";
import { useRouter } from "next/navigation";

export function StageCompletionForm({ 
  orderId, 
  stageName, 
  sequence, 
  stageCount,
  operatorId,
  previousKgOut 
}: { 
  orderId: string; 
  stageName: string; 
  sequence: number;
  stageCount: number;
  operatorId: string;
  previousKgOut?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [kgIn, setKgIn] = useState(previousKgOut?.toString() || "");
  const [kgOut, setKgOut] = useState("");
  const [kgScrap, setKgScrap] = useState("");

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    formData.append("orderId", orderId);
    formData.append("stageName", stageName);
    formData.append("sequence", sequence.toString());
    formData.append("operatorId", operatorId);

    startTransition(async () => {
      try {
        await completeStage({
          orderId,
          stageName,
          sequence,
          kgIn: parseFloat(kgIn),
          kgOut: parseFloat(kgOut),
          kgScrap: parseFloat(kgScrap) || 0,
          operatorId,
        });
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to complete stage";
        setError(message);
      }
    });
  };

  const kgInNum = parseFloat(kgIn) || 0;
  const kgOutNum = parseFloat(kgOut) || 0;
  const kgScrapNum = parseFloat(kgScrap) || 0;
  const balance = kgInNum - (kgOutNum + kgScrapNum);
  const isBalanced = Math.abs(balance) < 0.001;

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Kg In {sequence > 1 && <span className="text-zinc-400">(from previous stage)</span>}
          </label>
          <input
            type="number"
            step="0.01"
            value={kgIn}
            onChange={(e) => setKgIn(e.target.value)}
            required
            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Kg Out</label>
          <input
            type="number"
            step="0.01"
            value={kgOut}
            onChange={(e) => setKgOut(e.target.value)}
            required
            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Kg Scrap</label>
          <input
            type="number"
            step="0.01"
            value={kgScrap}
            onChange={(e) => setKgScrap(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className={`p-3 rounded-md ${isBalanced ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Balance: {balance.toFixed(3)} kg 
            {isBalanced ? " ✓" : " (must equal 0)"}
          </span>
          <span className="text-sm text-zinc-500">
            Formula: {kgInNum.toFixed(2)} = {kgOutNum.toFixed(2)} + {kgScrapNum.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!isBalanced || isPending}
          className={`px-6 py-2 font-medium rounded-md ${
            isBalanced && !isPending
              ? "bg-zinc-900 text-white hover:bg-zinc-800"
              : "bg-zinc-300 text-zinc-500 cursor-not-allowed"
          }`}
        >
          {isPending ? "Processing..." : `Complete Stage ${sequence}/${stageCount}`}
        </button>
      </div>
    </form>
  );
}