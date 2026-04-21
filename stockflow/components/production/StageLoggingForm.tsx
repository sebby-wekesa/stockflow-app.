"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StageLogSchema } from "@/lib/schemas/production";
import { completeStage } from "@/lib/actions/production";
import { useState } from "react";

export default function StageLoggingForm({ job, operatorId }: { job: any, operatorId: string }) {
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(StageLogSchema),
    defaultValues: {
      kgIn: job.targetKg, // Pre-filled from previous stage output 
      kgOut: 0,
      kgScrap: 0,
    }
  });

  const kgIn = watch("kgIn");
  const kgOut = watch("kgOut");
  const kgScrap = watch("kgScrap");
  const currentTotal = Number(kgOut) + Number(kgScrap);
  const diff = Number(kgIn) - currentTotal;

  const onSubmit = async (data: any) => {
    const result = await completeStage({ ...data, orderId: job.id, operatorId });
    if (result.error) setServerError(result.error);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6 border rounded-xl bg-white shadow-sm">
      <div className="grid grid-cols-3 gap-4">
        {/* Kg In: Received from previous dept [cite: 77] */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Kg In (Received)</label>
          <input {...register("kgIn", { valueAsNumber: true })} type="number" step="0.01" 
                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50" readOnly />
        </div>

        {/* Kg Out: Passed to next dept [cite: 77] */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Kg Out (Passed Forward)</label>
          <input {...register("kgOut", { valueAsNumber: true })} type="number" step="0.01" 
                 className="mt-1 block w-full rounded-md border-blue-500 shadow-sm focus:ring-blue-500" />
        </div>

        {/* Kg Scrap: Lost during processing [cite: 77, 153] */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Kg Scrap</label>
          <input {...register("kgScrap", { valueAsNumber: true })} type="number" step="0.01" 
                 className="mt-1 block w-full rounded-md border-red-300 shadow-sm focus:ring-red-500" />
        </div>
      </div>

      {/* Real-time Balance Indicator [cite: 56] */}
      <div className={`p-3 rounded-md text-sm font-medium ${Math.abs(diff) < 0.01 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
        {Math.abs(diff) < 0.01 
          ? "✓ Balance confirmed: In = Out + Scrap" 
          : `⚠ Balance mismatch: Remaining difference is ${diff.toFixed(2)} kg`}
      </div>

      {/* Scrap Reason: Required if scrap > 0  */}
      {kgScrap > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Scrap Reason</label>
          <select {...register("scrapReason")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
            <option value="off-cuts">Off-cuts (Cutting)</option>
            <option value="scale">Scale and Flash (Forging)</option>
            <option value="swarf">Swarf (Skimming/Drilling/Grinding)</option>
            <option value="other">Other</option>
          </select>
        </div>
      )}

      <button type="submit" disabled={isSubmitting || Math.abs(diff) > 0.01}
              className="w-full py-3 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
        {isSubmitting ? "Processing..." : "Complete Stage & Notify Next Dept"}
      </button>
      
      {serverError && <p className="text-red-600 text-sm mt-2">{serverError}</p>}
    </form>
  );
}