export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { stageCompletionSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    // 1. Verify Authentication & Role
    const user = await requireActiveAuth();
    
    // Check if user has OPERATOR or ADMIN role
    if (user.role !== 'OPERATOR' && user.role !== 'ADMIN') {
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

    // 3. Prepare validation input (merging body with order/user info)
    const stages = order.design?.stages || [];
    const currentStageIndex = stages.findIndex((s: any) => s.id === body.stageId || s.sequence === order.currentStage);
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

    // 5. Create the stage log
    const log = await db.stageLog.create({
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
        organizationId: user.organizationId,
      }
    });

    // 5. Update the Production Order (The Handoff)
    const isLastStage = !nextStage;

    await db.productionOrder.update({
      where: { id: body.orderId },
      data: {
        targetKg: kgOut,
        currentStage: nextStage ? nextStage.sequence : order.currentStage,
        currentDept: nextStage ? nextStage.department : order.currentDept,
        status: isLastStage ? "COMPLETED" : "IN_PRODUCTION",
        ...(isLastStage ? { completedAt: new Date() } : {}),
      }
    });

    // 6. If completed, add to finished goods inventory
    if (isLastStage) {
      // Generate SKU (FG-YYYY-NNNN)
      const currentYear = new Date().getFullYear();
      const lastFinishedGoods = await db.finishedGoods.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { sku: true },
      });

      let nextNumber = 1;
      if (lastFinishedGoods?.sku) {
        const match = lastFinishedGoods.sku.match(/FG-\d{4}-(\d{4})/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const sku = `FG-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;

      await db.finishedGoods.create({
        data: {
          sku,
          designId: order.designId,
          quantity: order.quantity,
          kgProduced: kgOut,
          organizationId: user.organizationId,
        }
      });
    }

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