"use server";

import { completeStage as completeLifecycleStage } from "@/app/actions/stage-completion";
import { stageCompletionSchema, type StageCompletionInput } from "@/lib/validations";

// Backward-compatible entry point for older forms. All stage writes now pass
// through the shared lifecycle action, which enforces role, department,
// sequence, weight balance, material consumption, and linked sales handling.
export async function completeStage(input: StageCompletionInput) {
  const validated = stageCompletionSchema.parse(input);
  return completeLifecycleStage({
    orderId: validated.orderId,
    stageId: validated.stageId,
    stageName: validated.stageName,
    sequence: validated.sequence,
    kgIn: validated.kgIn,
    kgOut: validated.kgOut,
    kgScrap: validated.kgScrap,
    piecesIn: validated.piecesIn,
    piecesOut: validated.piecesOut,
    scrapReason: validated.scrapReason,
    department: validated.department,
    notes: validated.notes,
  });
}
