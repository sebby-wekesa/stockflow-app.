"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import type { FinishedGoods, Design } from "@prisma/client";

export async function getCatalogue() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Get finished goods that are available for sale (tenant scoped)
  let finishedGoods: (FinishedGoods & { design: Design })[] = []
  try {
    finishedGoods = await db.finishedGoods.findMany({
      where: {
        quantity: {
          gt: 0,
        },
      },
      include: {
        design: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.warn('Failed to fetch catalogue:', error)
    finishedGoods = []
  }

  return finishedGoods.map(fg => ({
    id: fg.id,
    name: fg.design.name,
    code: fg.design.code,
    availableQty: fg.quantity,
    kgProduced: fg.kgProduced,
    price: 0, // Would need to add pricing logic
    createdAt: fg.createdAt,
  }));
}

export async function getMyOrders() {
  await requireActiveAuth();

  // This would need to be implemented based on your sales order schema
  // For now, return empty array since the schema shows SaleOrder but no user relation
  return [];

  // When sales orders are properly linked to users:
  /*
  const orders = await prisma.saleOrder.findMany({
    where: {
      // Add user relation when schema is updated
    },
    include: {
      items: {
        include: {
          finishedGoods: {
            include: {
              design: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return orders.map(order => ({
    id: order.id,
    orderNumber: `SO-${order.id.slice(-6)}`,
    createdAt: order.createdAt,
    status: order.status,
    totalAmount: order.totalAmount,
    itemCount: order.items.length,
  }));
  */
}