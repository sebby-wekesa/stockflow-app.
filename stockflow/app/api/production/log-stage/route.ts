export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getUser, requireRole } from "@/lib/auth";
import { stageCompletionSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    // 1. Verify Authentication & Role [cite: 55, 137]
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    // Check if user has OPERATOR or ADMIN role
    if (user.role !== 'OPERATOR' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden: Only operators can log production" }, { status: 403 });
    }

    const body = await req.json();

    // 2. Get the current order with full stage sequence to identify the stage details
    const order = await prisma.productionOrder.findUnique({
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

    // 3. Prepare validation input (merging body with order/user info)
    const stages = order.design.stages;
    const currentStageIndex = stages.findIndex(s => s.id === body.stageId || s.sequence === order.currentStage);
    const currentStage = stages[currentStageIndex];
    
    if (!currentStage) {
      return NextResponse.json({ error: "Current stage not found in sequence" }, { status: 404 });
    }

    // 4. Validate with Zod Schema
    const validationInput = {
      ...body,
      stageName: currentStage.name,
      sequence: currentStage.sequence,
      operatorId: user.id,
      department: currentStage.department,
    };

    const validation = stageCompletionSchema.safeParse(validationInput);
    if (!validation.success) {
      return NextResponse.json({ 
        error: "Validation failed", 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { kgIn, kgOut, kgScrap, scrapReason } = validation.data;
    const nextStage = stages[currentStageIndex + 1];

    // 5. Create the stage log [cite: 147, 153]
    const log = await prisma.stageLog.create({
      data: {
        orderId: body.orderId,
        kgIn,
        kgOut,
        kgScrap: kgScrap || 0,
        scrapReason,
        stageName: currentStage.name,
        sequence: currentStage.sequence,
        operatorId: user.id,
        department: currentStage.department,
      }
    });

    // 5. Update the Production Order (The Handoff) [cite: 99, 103]
    const isLastStage = !nextStage;
    
    await prisma.productionOrder.update({
      where: { id: body.orderId },
      data: {
        targetKg: kgOut,
        currentStage: nextStage ? nextStage.sequence : order.currentStage,
        currentDept: nextStage ? nextStage.department : order.currentDept,
        status: isLastStage ? "COMPLETED" : "IN_PRODUCTION",
      }
    });

    return NextResponse.json({
      success: true,
      message: isLastStage ? "Order completed" : `Advanced to ${nextStage.department}`,
      log,
      isCompleted: isLastStage
    });

  } catch (error) {
    console.error("Stage logging error:", error);
    return NextResponse.json({ error: "Failed to log stage" }, { status: 500 });
  }
}