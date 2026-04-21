// lib/actions/inventory.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function receiveRawMaterial(data: {
  rawMaterialId: string;
  quantity: number;
  supplierId: string;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Create the Receipt record
      await tx.rawMaterialReceipt.create({
        data: {
          rawMaterialId: data.rawMaterialId,
          quantity: data.quantity,
          supplierId: data.supplierId,
        },
      });

      // 2. Update the total stock balance
      await tx.rawMaterial.update({
        where: { id: data.rawMaterialId },
        data: {
          availableKg: { increment: data.quantity },
        },
      });

      // 3. Log a Stock Transaction for the audit trail
      await tx.stockTransaction.create({
        data: {
          itemType: 'raw',
          itemId: data.rawMaterialId,
          transactionType: 'receipt',
          quantity: data.quantity,
          reason: "Supplier Delivery",
          performedBy: "SYSTEM_USER", // Replace with actual session userId
        },
      });
    });

    revalidatePath("/dashboard/warehouse");
    return { success: true };
  } catch (error) {
    console.error("Intake Error:", error);
    return { error: "Failed to process material intake." };
  }
}