"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { revalidatePath } from 'next/cache';

export async function getPackagingQueue() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Only packaging staff, admins, and managers can access packaging queue
  if (user.role !== 'PACKAGING' && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only packaging staff can access this queue');
  }

  // Get confirmed sales orders that have items ready for packaging
  const salesOrders = await db.saleOrder.findMany({
    where: {
      status: 'CONFIRMED'
    },
    include: {
      Customer: true,
      SaleItem: {
        include: {
          FinishedGoods: {
            include: {
              design: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'asc' // FIFO - oldest orders first
    }
  });

  // Filter to only include orders where all items have available finished goods
  const packableOrders = salesOrders.filter(order => {
    return order.SaleItem.every(item => {
      const finishedGoods = item.FinishedGoods;
      return finishedGoods && finishedGoods.quantity >= item.quantity;
    });
  });

  return packableOrders.map(order => ({
    id: order.id,
    orderNumber: order.id,
    customerName: order.Customer?.name || order.customerName,
    totalItems: order.SaleItem.length,
    totalQuantity: order.SaleItem.reduce((sum, item) => sum + item.quantity, 0),
    totalKg: order.SaleItem.reduce((sum, item) => {
      const finishedGoods = item.FinishedGoods
      const kgPerUnit = finishedGoods.quantity > 0
        ? Number(finishedGoods.kgProduced) / finishedGoods.quantity
        : 0
      return sum + (item.quantity * kgPerUnit)
    }, 0),
    createdAt: order.createdAt,
    items: order.SaleItem.map(item => ({
      id: item.id,
      designName: item.FinishedGoods?.design?.name || 'Unknown',
      designCode: item.FinishedGoods?.design?.code || 'N/A',
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      availableStock: item.FinishedGoods?.quantity || 0
    }))
  }));
}

export async function fulfillOrder(orderId: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Only packaging staff, admins, and managers can fulfill orders
  if (user.role !== 'PACKAGING' && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only packaging staff can fulfill orders');
  }

  // Use transaction for atomic fulfillment
  return await db.$transaction(async (tx) => {
    const order = await tx.saleOrder.findUnique({
      where: { id: orderId },
      include: {
        SaleItem: {
          include: {
            FinishedGoods: {
              include: {
                design: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      throw new Error('Sales order not found');
    }

    if (order.status !== 'CONFIRMED') {
      throw new Error('Order is not in a fulfillable state');
    }

    // Verify all items are still available
    for (const item of order.SaleItem) {
      if (!item.FinishedGoods || item.FinishedGoods.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${item.FinishedGoods?.design?.name || 'item'}`);
      }
    }

    // Update finished goods inventory (reduce quantities)
    for (const item of order.SaleItem) {
      await tx.finishedGoods.update({
        where: { id: item.finishedGoodsId },
        data: {
          quantity: {
            decrement: item.quantity
          }
        }
      });
    }

    // Mark order as shipped
    await tx.saleOrder.update({
      where: { id: orderId },
      data: {
        status: 'SHIPPED'
      }
    });

    revalidatePath('/packaging');
    revalidatePath('/pack_done');
    revalidatePath('/sales');

    return {
      success: true,
      orderId,
      fulfilledAt: new Date(),
      totalItems: order.SaleItem.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0)
    };
  });
}

export async function getPackagingStats() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const [
    pendingOrders,
    shippedToday,
    totalPackagedThisWeek
  ] = await Promise.all([
    // Pending orders count
    db.saleOrder.count({
      where: { status: 'CONFIRMED' }
    }),

    // Orders shipped today
    db.saleOrder.count({
      where: {
        status: 'SHIPPED',
        updatedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    }),

    // Total items packaged this week
    db.saleOrder.aggregate({
      where: {
        status: 'SHIPPED',
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      _sum: {
        totalAmount: true
      }
    })
  ]);

  return {
    pendingOrders,
    shippedToday,
    weeklyRevenue: Number(totalPackagedThisWeek._sum.totalAmount || 0)
  };
}
