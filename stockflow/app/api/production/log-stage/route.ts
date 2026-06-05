export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { requireActiveAuth } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { completeStage } from "@/app/actions/stage-completion";
import { assertOperatorDepartment } from "@/lib/operator-access";

export async function POST(req: Request) {
  try {
    // 1. Verify Authentication & Role
    const user = await requireActiveAuth();
    
    if (!['OPERATOR', 'ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden: Only operators can log production" }, { status: 403 });
    }

    const db = getTenantPrisma(user.organizationId);
    const body = await req.json();

    // 2. Get the current order with full stage sequence to identify the stage details
    const order = await db.productionOrder.findUnique({
      where: { id: body.orderId },
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

    if (order.status !== 'IN_PRODUCTION') {
      return NextResponse.json({ error: 'Order is not in production' }, { status: 400 });
    }
    assertOperatorDepartment(user, order.currentDept);

    const stages = order.design?.stages || [];
    const currentStageIndex = stages.findIndex((s: any) => s.id === body.stageId || s.sequence === order.currentStage);
    const currentStage = stages[currentStageIndex];
    
    if (!currentStage) {
      return NextResponse.json({ error: "Current stage not found in sequence" }, { status: 404 });
    }

    const result = await completeStage({
      orderId: order.id,
      stageId: currentStage.id,
      stageName: currentStage.name,
      sequence: currentStage.sequence,
      department: currentStage.department,
      kgIn: Number(body.kgIn),
      kgOut: Number(body.kgOut),
      kgScrap: Number(body.kgScrap || 0),
      piecesIn: body.piecesIn === undefined || body.piecesIn === null || body.piecesIn === "" ? undefined : Number(body.piecesIn),
      piecesOut: body.piecesOut === undefined || body.piecesOut === null || body.piecesOut === "" ? undefined : Number(body.piecesOut),
      scrapReason: body.scrapReason,
      notes: body.notes,
    });

    return NextResponse.json({
      success: true,
      message: result.orderCompleted ? "Order completed" : `Advanced to ${result.nextStage?.department}`,
      log: {
        ...result.stageLog,
        kgIn: Number(result.stageLog.kgIn),
        kgOut: Number(result.stageLog.kgOut),
        kgScrap: Number(result.stageLog.kgScrap),
        piecesIn: result.stageLog.piecesIn,
        piecesOut: result.stageLog.piecesOut,
        completedAt: result.stageLog.completedAt.toISOString(),
      },
      isCompleted: result.orderCompleted
    });

  } catch (error) {
    console.error("Stage logging error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to log stage" }, { status: 500 });
  }
}
