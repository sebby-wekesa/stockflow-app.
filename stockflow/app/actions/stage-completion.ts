"use server";

import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { stageLogSchema } from "@/lib/schemas";
import { revalidatePath } from 'next/cache';
import { reserveSaleOrder } from '@/lib/order-lifecycle';
import { assertOperatorDepartment } from '@/lib/operator-access';

export async function completeStage(data: {
  orderId: string;
  stageId?: string;
  stageName: string;
  sequence: number;
  kgIn: number;
  kgOut: number;
  kgScrap: number;
  piecesIn?: number;
  piecesOut?: number;
  scrapReason?: string;
  department?: string;
  notes?: string;
}) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Validate user permissions
  if (user.role !== 'OPERATOR' && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only operators can complete stages');
  }

  // Validate input data
  const validatedData = stageLogSchema.parse({ ...data, operatorId: user.id });

  // Use database transaction for atomicity (tenant-scoped)
  return await withTenantTransaction(user.organizationId, async (tx) => {
    // Get the production order
    const order = await tx.productionOrder.findUnique({
      where: { id: validatedData.orderId },
      include: {
        design: {
          include: {
            stages: {
              orderBy: { sequence: 'asc' }
            },
            billOfMaterials: true
          }
        },
        saleItem: {
          include: {
            FinishedGoods: true,
          },
        },
        StageLog: {
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
    assertOperatorDepartment(user, order.currentDept);

    // Verify this is the correct stage sequence
    if (validatedData.sequence !== order.currentStage) {
      throw new Error(`Invalid stage sequence. Expected: ${order.currentStage}, Got: ${validatedData.sequence}`);
    }

    // Verify kg_in matches the expected input
    const expectedKgIn = order.StageLog.length > 0 ? order.StageLog[0].kgOut : order.targetKg;
    if (Math.abs(Number(expectedKgIn) - validatedData.kgIn) > 0.0001) {
      throw new Error(`KG input mismatch. Expected: ${expectedKgIn}, Got: ${validatedData.kgIn}`);
    }

    // Create the stage log
    const stageLog = await tx.stageLog.create({
      data: {
        organizationId: user.organizationId,
        orderId: validatedData.orderId,
        stageId: validatedData.stageId,
        stageName: validatedData.stageName,
        sequence: validatedData.sequence,
        kgIn: validatedData.kgIn,
        kgOut: validatedData.kgOut,
        kgScrap: validatedData.kgScrap,
        piecesIn: validatedData.piecesIn ?? null,
        piecesOut: validatedData.piecesOut ?? null,
        scrapReason: validatedData.scrapReason,
        department: validatedData.department || user.department,
        operatorId: user.id,
        notes: validatedData.notes
      }
    });

    // Determine next stage and update order
    const nextStageSequence = validatedData.sequence + 1;
    const nextStage = order.design?.stages?.find((s: any) => s.sequence === nextStageSequence);

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

      for (const bomItem of order.design.billOfMaterials) {
        const requiredKg = Number(bomItem.quantity) * order.quantity;
        const material = await tx.rawMaterial.findUnique({
          where: { id: bomItem.rawMaterialId },
        });
        const reservedKg = Number(material?.reservedKg || 0);

        if (reservedKg > 0) {
          await tx.rawMaterial.update({
            where: { id: bomItem.rawMaterialId },
            data: {
              reservedKg: { decrement: Math.min(reservedKg, requiredKg) },
            },
          });
        }

        await tx.materialConsumptionLog.create({
          data: {
            productionOrderId: order.id,
            rawMaterialId: bomItem.rawMaterialId,
            quantityConsumed: requiredKg,
            notes: 'Consumed from reserved material on final stage completion',
            organizationId: user.organizationId,
          },
        });
      }

      if (order.saleItem?.FinishedGoods) {
        await tx.finishedGoods.update({
          where: { id: order.saleItem.finishedGoodsId },
          data: {
            quantity: { increment: order.quantity },
            kgProduced: { increment: validatedData.kgOut },
          },
        });

        if (order.saleOrderId) {
          const openLinkedOrders = await tx.productionOrder.count({
            where: {
              saleOrderId: order.saleOrderId,
              id: { not: order.id },
              status: { not: 'COMPLETED' },
            },
          });

          if (openLinkedOrders === 0) {
            const saleOrder = await tx.saleOrder.findUnique({
              where: { id: order.saleOrderId },
              include: { SaleItem: { include: { FinishedGoods: true } } },
            });
            if (!saleOrder) throw new Error('Linked sales order not found');
            await reserveSaleOrder(tx, saleOrder);
          }
        }
      } else {
        // Create finished goods entry for production orders not linked to a sale.
        const sku = `FG-${order.design.code}-${order.quantity}-${Date.now().toString().slice(-6)}`;
        await tx.finishedGoods.create({
          data: {
            organizationId: user.organizationId,
            sku,
            designId: order.design.id,
            quantity: order.quantity,
            kgProduced: validatedData.kgOut
          }
        });
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/production');
    revalidatePath('/jobs');
    revalidatePath('/operator');
    revalidatePath('/operator_queue');
    revalidatePath('/packaging');
    revalidatePath('/sales');

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
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const order = await db.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      design: {
        include: {
          stages: {
            orderBy: { sequence: 'asc' }
          }
        }
      },
      StageLog: {
        orderBy: { sequence: 'desc' },
        take: 1
      }
    }
  });

  if (!order) {
    throw new Error('Production order not found');
  }

  // Check permissions - operators can only see orders in their department
  assertOperatorDepartment(user, order.currentDept);

  if (!order.design) {
    throw new Error('Direct orders use production output recording instead of stage completion');
  }

  const currentStage = order.design.stages.find(s => s.sequence === order.currentStage);
  const inheritedKg = order.StageLog.length > 0 ? order.StageLog[0].kgOut : order.targetKg;

  return {
    ...order,
    currentStage,
    inheritedKg: Number(inheritedKg)
  };
}
