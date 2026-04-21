// lib/actions/bom-automation.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function releaseOrderWithBOM(orderId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch order with BOM (Design -> RawMaterial) details
      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
        include: { 
          design: { 
            include: { 
              stages: { orderBy: { sequence: 'asc' } } 
            } 
          } 
        }
      });

      if (!order || !order.design.rawMaterialId) {
        throw new Error("Order or BOM configuration missing.");
      }

      // 2. Verify and Consume Material
      const material = await tx.rawMaterial.findUnique({
        where: { id: order.design.rawMaterialId }
      });

      if (!material || material.availableKg < order.targetKg) {
        throw new Error(`Insufficient stock for ${material?.materialName || 'required material'}`);
      }

      // 3. Update Inventory: Move from Available to Reserved
      await tx.rawMaterial.update({
        where: { id: order.design.rawMaterialId },
        data: {
          availableKg: { decrement: order.targetKg },
          reservedKg: { increment: order.targetKg }
        }
      });

      // 4. Route to first department
      const firstStage = order.design.stages[0];
      await tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: "IN_PRODUCTION",
          currentStage: firstStage.sequence,
          currentDept: firstStage.department,
        }
      });

      return { success: true };
    });
  } catch (error: any) {
    return { error: error.message };
  }
}