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
      const depts = await getDepartmentsForOrg(user.organizationId);
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

        // 1. Resolve the route type (derived for template-based, or existing for direct)
        const resolvedRouteType = order.routeType ?? (
          order.design ? (
            order.design.stages.some((stage: any) =>
              ['Eye Rolling', 'Scaffolding', 'Tapering'].some(keyword =>
                stage.name.toLowerCase().includes(keyword.toLowerCase())
              )
            ) ? 'FML' : 'HML'
          ) : null
        );

        // 2. Fetch the active route if we have a route type
        let route = null;
        if (resolvedRouteType) {
          route = await tx.productionRoute.findFirst({
            where: { routeType: resolvedRouteType, isActive: true },
            include: { operations: { orderBy: { sequence: "asc" } } },
          });
          if (!route || route.operations.length === 0) {
            throw new Error(`No active ${resolvedRouteType} route configured. Set up routes first.`);
          }
        }

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
              routeType: resolvedRouteType,
            },
          });
        } else {
          const firstDepartment = depts[0];
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
              routeType: resolvedRouteType,
            },
          });
        }

        // 3. Create operation logs if route exists
        if (route && route.operations.length > 0) {
          const existingOps = await tx.operationLog.count({ where: { productionOrderId: orderId } });
          if (existingOps === 0) {
            await tx.operationLog.createMany({
              data: route.operations.map((operation: any) => ({
                productionOrderId: orderId,
                routeOperationId: operation.id,
                operationName: operation.name,
                sequence: operation.sequence,
                section: operation.section,
                optional: operation.optional,
                status: "PENDING",
                organizationId: user.organizationId,
              })),
            });
          }
        }
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
