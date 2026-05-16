"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateOrderStatus(orderId: string, status: "APPROVED" | "REJECTED") {
  try {
    await prisma.productionOrder.update({
      where: { id: orderId },
      data: { status },
    });
    
    // Refresh the page data automatically
    revalidatePath("/approvals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to update order status:", error);
    return { success: false, error: "Failed to update order status" };
  }
}
