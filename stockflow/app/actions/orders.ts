"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getDepartmentsForOrg } from "@/lib/department-settings";

export async function updateOrderStatus(
  orderId: string,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string
) {
  try {
    const user = await requireActiveAuth();
    if (!["ADMIN", "MANAGER"].includes(user.role)) {
      return { success: false, error: "Only admins and managers can approve production orders" };
    }

    const db = getTenantPrisma(user.organizationId);

    if (status === "REJECTED") {
      if (!rejectionReason || rejectionReason.trim().length < 3) {
        throw new Error("A rejection reason of at least 3 characters is required");
      }
      const rejected = await db.productionOrder.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: { status: "REJECTED", rejectionReason: rejectionReason.trim() },
      });
      if (rejected.count === 0) throw new Error('Only pending orders can be rejected');
    } else {
      await db.$transaction(async (tx) => {
        const order = await tx.productionOrder.findUnique({
          where: { id: orderId },
          include: {
            design: {
              include: {
                stages: { orderBy: { sequence: "asc" } },
                billOfMaterials: { include: { RawMaterial: true } },
              },
            },
          },
        });

        if (!order) throw new Error("Production order not found");
        if (order.status !== "PENDING") throw new Error("Only pending orders can be approved");

        if (order.design) {
          if (order.design.stages.length === 0) throw new Error("Design has no production stages");
          if (order.design.billOfMaterials.length === 0) throw new Error("Design has no raw material BOM");

          for (const bomItem of order.design.billOfMaterials) {
            const requiredKg = Number(bomItem.quantity) * order.quantity;
            const availableKg = Number(bomItem.RawMaterial.availableKg);

            if (availableKg < requiredKg) {
              throw new Error(
                `Insufficient stock for ${bomItem.RawMaterial.materialName}. Required: ${requiredKg}kg, available: ${availableKg}kg`
              );
            }

            await tx.rawMaterial.update({
              where: { id: bomItem.rawMaterialId },
              data: {
                availableKg: { decrement: requiredKg },
                reservedKg: { increment: requiredKg },
              },
            });
          }

          const firstStage = order.design.stages[0];
          await tx.productionOrder.update({
            where: { id: orderId },
            data: {
              status: "IN_PRODUCTION",
              approvedBy: user.id,
              approvedAt: new Date(),
              rejectionReason: null,
              currentStage: firstStage.sequence,
              currentDept: firstStage.department,
            },
          });
          return;
        }

        const firstDepartment = getDepartmentsForOrg(user.organizationId)[0];
        if (!firstDepartment) {
          throw new Error("Configure at least one production department before approving direct orders");
        }
        await tx.productionOrder.update({
          where: { id: orderId },
          data: {
            status: "IN_PRODUCTION",
            approvedBy: user.id,
            approvedAt: new Date(),
            rejectionReason: null,
            currentStage: 1,
            currentDept: order.currentDept ?? firstDepartment,
          },
        });
      });
    }
    
    // Refresh the page data automatically
    revalidatePath("/approvals");
    revalidatePath("/dashboard");
    revalidatePath("/jobs");
    revalidatePath("/operator");
    revalidatePath("/operator_queue");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update order status:", error);
    return { success: false, error: error.message || "Failed to update order status" };
  }
}
