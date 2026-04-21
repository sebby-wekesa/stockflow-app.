export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      orderId, 
      kgIn, 
      kgOut, 
      kgScrap, 
      scrapReason, 
      notes, 
      currentSequence, 
      stageName, 
      operatorId 
    } = body;

    // 1. Validate required fields for the Stage Log
    if (!orderId || kgIn === undefined || kgOut === undefined || !stageName || currentSequence === undefined) {
       return NextResponse.json({ error: "Missing required fields for handoff" }, { status: 400 });
    }

    // 2. Determine operatorId if not provided (fallback to first operator for demo purposes)
    let effectiveOperatorId = operatorId;
    if (!effectiveOperatorId) {
      const firstOperator = await prisma.user.findFirst({ where: { role: "OPERATOR" } });
      effectiveOperatorId = firstOperator?.id;
    }

    if (!effectiveOperatorId) {
      return NextResponse.json({ error: "No operator associated with this action" }, { status: 400 });
    }

    // 3. Create the Stage Log record for history
    const log = await prisma.stageLog.create({
      data: {
        orderId,
        kgIn,
        kgOut,
        kgScrap: kgScrap || 0,
        scrapReason,
        notes,
        stageName,
        sequence: currentSequence,
        operatorId: effectiveOperatorId,
      }
    });

    // 4. Dynamic Logic to find the next stage/department
    // We fetch the current order to get its designId
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        design: {
          include: {
            stages: {
              orderBy: { sequence: "asc" }
            }
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Production order not found" }, { status: 404 });
    }

    // Find the current stage index and next stage
    const currentStageIndex = order.design.stages.findIndex(s => s.sequence === currentSequence);
    const nextStage = order.design.stages[currentStageIndex + 1];

    let nextDept = "Completed";
    let finalStatus = "COMPLETED" as const;
    let nextSeq = currentSequence + 1;

    if (nextStage) {
      nextDept = nextStage.department;
      finalStatus = "IN_PRODUCTION";
      nextSeq = nextStage.sequence;
    }

    // 5. Update the Production Order to move it to the next queue
    const updatedOrder = await prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        currentStage: nextSeq,
        currentDept: nextDept,
        status: finalStatus,
        // Update targetKg for the next stage based on what actually came out of this one
        targetKg: kgOut 
      }
    });

    return NextResponse.json({ 
      success: true, 
      log,
      transition: {
        from: stageName,
        to: nextDept,
        nextSequence: nextSeq,
        status: finalStatus
      }
    });

  } catch (error) {
    console.error("Factory Handoff Error:", error);
    return NextResponse.json({ error: "Failed to move order to next stage" }, { status: 500 });
  }
}