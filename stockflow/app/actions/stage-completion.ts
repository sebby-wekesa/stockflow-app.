"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { stageLogSchema } from "@/lib/schemas";
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

export async function completeStage(data: {
  orderId: string;
  stageId?: string;
  stageName: string;
  sequence: number;
  kgIn: number;
  kgOut: number;
  kgScrap: number;
  scrapReason?: string;
  department?: string;
  notes?: string;
}) {
  const user = await requireAuth();

  // Validate user permissions
  if (user.role !== 'OPERATOR' && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only operators can complete stages');
  }

  // Validate input data
  const validatedData = stageLogSchema.parse(data);

  // Use database transaction for atomicity
  return await prisma.$transaction(async (tx) => {
    // Get the production order
    const order = await tx.productionOrder.findUnique({
      where: { id: validatedData.orderId },
      include: {
        design: {
          include: {
            stages: {
              orderBy: { sequence: 'asc' }
            }
          }
        },
        logs: {
          orderBy: { sequence: 'desc' },
          take: 1
        }
      }
    });

    if (!order) {
      throw new Error('Production order not found');
    }

    if (order.status !== 'IN_PRODUCTION') {
      throw new Error('Order is not in production status');
    }

    // Verify this is the correct stage sequence
    if (validatedData.sequence !== order.currentStage) {
      throw new Error(`Invalid stage sequence. Expected: ${order.currentStage}, Got: ${validatedData.sequence}`);
    }

    // Verify kg_in matches the expected input
    const expectedKgIn = order.logs.length > 0 ? order.logs[0].kgOut : order.targetKg;
    if (Math.abs(Number(expectedKgIn) - validatedData.kgIn) > 0.0001) {
      throw new Error(`KG input mismatch. Expected: ${expectedKgIn}, Got: ${validatedData.kgIn}`);
    }

    // Create the stage log
    const stageLog = await tx.stageLog.create({
      data: {
        orderId: validatedData.orderId,
        stageId: validatedData.stageId,
        stageName: validatedData.stageName,
        sequence: validatedData.sequence,
        kgIn: validatedData.kgIn,
        kgOut: validatedData.kgOut,
        kgScrap: validatedData.kgScrap,
        scrapReason: validatedData.scrapReason,
        department: validatedData.department || user.department,
        operatorId: user.id,
        notes: validatedData.notes
      }
    });

    // Determine next stage and update order
    const nextStageSequence = validatedData.sequence + 1;
    const nextStage = order.design.stages.find(s => s.sequence === nextStageSequence);

    if (nextStage) {
      // Move to next stage
      await tx.productionOrder.update({
        where: { id: validatedData.orderId },
        data: {
          currentStage: nextStageSequence,
          currentDept: nextStage.department
        }
      });
    } else {
      // This was the final stage - complete the order
      await tx.productionOrder.update({
        where: { id: validatedData.orderId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          currentStage: nextStageSequence // Beyond the last stage
        }
      });

      // Create finished goods entry
      const sku = `FG-${order.design.code}-${order.quantity}-${Date.now().toString().slice(-6)}`;
      await tx.finishedGoods.create({
        data: {
          sku,
          designId: order.designId,
          quantity: order.quantity,
          kgProduced: validatedData.kgOut
        }
      });
    }

    // If this was the final stage, we might want to release reserved materials
    // For now, we'll keep them reserved in case of returns/rework

    revalidatePath('/dashboard');
    revalidatePath('/production');

    return {
      success: true,
      stageLog,
      nextStage: nextStage ? {
        sequence: nextStage.sequence,
        name: nextStage.name,
        department: nextStage.department
      } : null,
      orderCompleted: !nextStage
    };
  });
}

export async function getOrderForCompletion(orderId: string) {
  const user = await requireAuth();

  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      design: {
        include: {
          stages: {
            orderBy: { sequence: 'asc' }
          }
        }
      },
      logs: {
        orderBy: { sequence: 'desc' },
        take: 1
      }
    }
  });

  if (!order) {
    throw new Error('Production order not found');
  }

  // Check permissions - operators can only see orders in their department
  if (user.role === 'OPERATOR' && order.currentDept !== user.department) {
    throw new Error('Unauthorized: Order not in your department');
  }

  const currentStage = order.design.stages.find(s => s.sequence === order.currentStage);
  const inheritedKg = order.logs.length > 0 ? order.logs[0].kgOut : order.targetKg;

  return {
    ...order,
    currentStage,
    inheritedKg: Number(inheritedKg)
  };
}