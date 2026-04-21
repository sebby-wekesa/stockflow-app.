"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";

export async function recordSale(data: {
  finishedGoodId: string;
  quantitySold: number;
  customerId: string;
}) {
  const user = await getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Check current stock levels
      const item = await tx.finishedGood.findUnique({
        where: { id: data.finishedGoodId },
      });

      if (!item || item.quantity < data.quantitySold) {
        throw new Error("Insufficient stock available.");
      }

      // 2. Reduce finished goods inventory
      await tx.finishedGood.update({
        where: { id: data.finishedGoodId },
        data: { quantity: { decrement: data.quantitySold } },
      });

      // 3. Log the stock transaction (Sale)
      await tx.stockTransaction.create({
        data: {
          itemType: 'finished',
          itemId: data.finishedGoodId,
          transactionType: 'sale',
          quantity: data.quantitySold,
          reason: `Sale to Customer: ${data.customerId}`,
          performedBy: user.id,
        },
      });
    });

    revalidatePath("/dashboard/sales");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to process sale." };
  }
}