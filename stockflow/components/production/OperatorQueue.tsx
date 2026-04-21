"use client";

import { useState } from "react";
import { completeStage } from "@/actions/stage";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageLogForm } from "../operator/StageLogForm";

interface Job {
  id: string;
  orderNumber: string;
  design: {
    name: string;
    targetDimensions: string | null;
  };
  currentStage: number;
  targetKg: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export default function OperatorQueue({ jobs, operatorDept, onJobComplete }: { jobs: Job[], operatorDept: string, onJobComplete?: () => void }) {
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{operatorDept} Department Queue</h1>
        <p className="text-muted-foreground">Active jobs requiring weight logging and processing.</p>
      </header>

      <div className="grid gap-4">
        {jobs.length === 0 ? (
          <p className="py-10 text-center border rounded-lg border-dashed">No active jobs in this queue.</p>
        ) : (
          jobs.map((job) => (
            <Card key={job.id} className="overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-secondary/20">
                <div>
                  <span className="text-sm font-mono font-medium">{job.orderNumber}</span>
                  <CardTitle className="text-lg">{job.design.name}</CardTitle>
                </div>
                <Badge variant={job.priority === "URGENT" ? "destructive" : "outline"}>
                  {job.priority}
                </Badge>
              </div>
              <CardContent className="p-4 grid md:grid-cols-3 gap-4 items-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Target Specs</p>
                  <p className="font-semibold">{job.design.targetDimensions || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Expected Input</p>
                  <p className="font-semibold">{job.targetKg} Kg</p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveJob(job)}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
                  >
                    Log Stage Output
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Stage Logging Modal */}
      {activeJob && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <button onClick={() => setActiveJob(null)} className="text-white mb-2 text-sm hover:underline">← Back to Queue</button>
            <StageLogForm
              order={{
                id: activeJob.id,
                code: activeJob.orderNumber,
                weight: activeJob.targetKg,
                designName: activeJob.design.name,
              }}
              onComplete={() => {
                setActiveJob(null);
                onJobComplete?.();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}