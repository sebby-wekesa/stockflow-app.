export const dynamic = 'force-dynamic';

import { requireActiveAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { completeStage } from "@/app/actions/stage-completion";

export async function POST(req: Request) {
  try {
    const user = await requireActiveAuth();
    const body = await req.json();
    const { 
      orderId, 
      kgIn, 
      kgOut, 
      kgScrap, 
      piecesIn,
      piecesOut,
      scrapReason, 
      notes, 
      currentSequence, 
      stageName, 
      operatorId
    } = body;
    void operatorId;

    // 1. Validate required fields for the Stage Log
    if (!orderId || kgIn === undefined || kgOut === undefined || !stageName || currentSequence === undefined) {
       return NextResponse.json({ error: "Missing required fields for handoff" }, { status: 400 });
    }

    if (!['OPERATOR', 'ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const result = await completeStage({
      orderId,
      stageName,
      sequence: currentSequence,
      kgIn: Number(kgIn),
      kgOut: Number(kgOut),
      kgScrap: Number(kgScrap || 0),
      piecesIn: piecesIn === undefined || piecesIn === null || piecesIn === "" ? undefined : Number(piecesIn),
      piecesOut: piecesOut === undefined || piecesOut === null || piecesOut === "" ? undefined : Number(piecesOut),
      scrapReason,
      notes,
    });

    return NextResponse.json({ 
      success: true, 
      log: {
        ...result.stageLog,
        kgIn: Number(result.stageLog.kgIn),
        kgOut: Number(result.stageLog.kgOut),
        kgScrap: Number(result.stageLog.kgScrap),
        piecesIn: result.stageLog.piecesIn,
        piecesOut: result.stageLog.piecesOut,
        completedAt: result.stageLog.completedAt.toISOString(),
      },
      transition: {
        from: stageName,
        to: result.nextStage?.department ?? 'Completed',
        nextSequence: result.nextStage?.sequence,
        status: result.orderCompleted ? 'COMPLETED' : 'IN_PRODUCTION'
      }
    });

  } catch (error) {
    console.error("Factory Handoff Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to move order to next stage" }, { status: 500 });
  }
}
