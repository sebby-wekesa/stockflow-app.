"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { revalidatePath } from 'next/cache';
import { consumeSaleOrderReservation } from '@/lib/order-lifecycle';

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

  // Confirmed orders have stock reserved specifically for packaging.
  const packableOrders = salesOrders.filter(order => {
    return order.SaleItem.every(item => {
      const finishedGoods = item.FinishedGoods;
      return finishedGoods && finishedGoods.reservedQuantity >= item.quantity;
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
      availableStock: item.FinishedGoods?.reservedQuantity || 0
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

    // Verify all items are still reserved for this order.
    for (const item of order.SaleItem) {
      if (!item.FinishedGoods || item.FinishedGoods.reservedQuantity < item.quantity) {
        throw new Error(`Insufficient reserved stock for ${item.FinishedGoods?.design?.name || 'item'}`);
      }
    }

    await consumeSaleOrderReservation(tx, order);

    // Product is a catalogue mirror for imported/local items. Physical stock
    // leaves both records only when packaging fulfils the confirmed order.
    for (const item of order.SaleItem) {
      const product = await tx.product.findFirst({
        where: { sku: item.FinishedGoods.sku },
      });
      if (!product) continue;

      const decremented = await tx.product.updateMany({
        where: { id: product.id, currentStock: { gte: item.quantity } },
        data: { currentStock: { decrement: item.quantity } },
      });
      if (decremented.count === 0) {
        throw new Error(`Product stock is inconsistent for ${item.FinishedGoods.sku}`);
      }

      await tx.stockMovement.create({
        data: {
          organizationId: user.organizationId,
          productId: product.id,
          movementType: 'sale',
          quantity: -item.quantity,
          reference: order.id,
          notes: `Fulfilled sale to ${order.customerName}`,
        },
      });
    }

    // Packaging is complete. Dispatch is a separate controlled handoff.
    await tx.saleOrder.update({
      where: { id: orderId },
      data: {
        status: 'READY_FOR_DISPATCH'
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

export async function markOrderShipped(orderId: string) {
  const user = await requireActiveAuth();
  if (!['PACKAGING', 'ADMIN', 'MANAGER'].includes(user.role)) {
    throw new Error('Unauthorized: Only packaging staff can dispatch orders');
  }
  const db = getTenantPrisma(user.organizationId);
  const updated = await db.saleOrder.updateMany({
    where: { id: orderId, status: 'READY_FOR_DISPATCH' },
    data: { status: 'SHIPPED' },
  });
  if (updated.count === 0) throw new Error('Order is not ready for dispatch');

  revalidatePath('/pack_done');
  revalidatePath('/sales');
  return { success: true };
}

export async function getPackagingStats() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const [
    pendingOrders,
    readyForDispatch,
    totalPackagedThisWeek
  ] = await Promise.all([
    // Pending orders count
    db.saleOrder.count({
      where: { status: 'CONFIRMED' }
    }),

    // Orders packed and ready for dispatch
    db.saleOrder.count({
      where: { status: 'READY_FOR_DISPATCH' }
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
    shippedToday: readyForDispatch,
    weeklyRevenue: Number(totalPackagedThisWeek._sum.totalAmount || 0)
  };
}
