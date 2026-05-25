"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateOrderStatus(orderId: string, status: "APPROVED" | "REJECTED") {
  try {
    const user = await requireActiveAuth();
    const db = getTenantPrisma(user.organizationId);

    await db.productionOrder.update({
      where: { id: orderId, organizationId: user.organizationId },
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
