// lib/actions/sales.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function processSale(data: {
  finishedGoodId: string;
  quantitySold: number;
  customerId: string;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Get the finished good to check stock
      const finishedGood = await tx.finishedGood.findUnique({
        where: { id: data.finishedGoodId },
        include: { design: true }
      });

      if (!finishedGood || finishedGood.quantity < data.quantitySold) {
        throw new Error("Insufficient stock.");
      }

      // 2. Create the Sale Order record
      await tx.saleOrder.create({
        data: {
          designId: finishedGood.designId,
          quantity: data.quantitySold,
          customerId: data.customerId,
          status: "SHIPPED", // Direct sale, assume shipped
          salesRepId: "SYSTEM_USER", // Replace with actual userId
        },
      });

      // 3. Decrement the stock
      await tx.finishedGood.update({
        where: { id: data.finishedGoodId },
        data: {
          quantity: { decrement: data.quantitySold },
        },
      });

      // 4. Log a Stock Transaction for the audit trail
      await tx.stockTransaction.create({
        data: {
          itemType: 'finished',
          itemId: data.finishedGoodId,
          transactionType: 'sale',
          quantity: data.quantitySold,
          reason: "Direct Sale",
          performedBy: "SYSTEM_USER", // Replace with actual session userId
        },
      });
    });

    revalidatePath("/dashboard/sales");
    return { success: true };
  } catch (error) {
    console.error("Sale Error:", error);
    return { error: "Failed to process sale." };
  }
}