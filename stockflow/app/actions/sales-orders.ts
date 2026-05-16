"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from 'next/cache';

export async function createSalesOrder(data: {
  customerId?: string;
  customerName: string;
  items: {
    finishedGoodsId: string;
    quantity: number;
    unitPrice: number;
  }[];
}) {
  // Validate input data
  if (!data.customerName || data.customerName.trim().length === 0) {
    throw new Error('Customer name is required');
  }

  if (!data.items || data.items.length === 0) {
    throw new Error('At least one item is required');
  }

  for (const item of data.items) {
    if (!item.finishedGoodsId) {
      throw new Error('All items must have a finished goods ID');
    }
    if (item.quantity <= 0) {
      throw new Error('Item quantities must be positive');
    }
    if (item.unitPrice < 0) {
      throw new Error('Item unit prices cannot be negative');
    }
  }

  const user = await requireAuth();

  // Only sales staff, admins, and managers can create sales orders
  if (user.role !== 'SALES' && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only sales staff can create orders');
  }

  // Use transaction for atomic order creation
  return await prisma.$transaction(async (tx) => {
    // Validate all items are available
    for (const item of data.items) {
      const finishedGoods = await tx.finishedGoods.findUnique({
        where: { id: item.finishedGoodsId },
        include: {
          Design: true
        }
      });

      if (!finishedGoods || finishedGoods.quantity < item.quantity) {
        throw new Error(`Insufficient stock for item ${finishedGoods?.Design?.name || 'unknown'}`);
      }
    }

    // Calculate totals
    const totalAmount = data.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    // Create the sales order
    const salesOrder = await tx.saleOrder.create({
      data: {
        customerId: data.customerId,
        customerName: data.customerName,
        totalAmount,
        status: 'PENDING', // Orders start as pending and need confirmation
        SaleItem: {
          create: data.items.map(item => ({
            finishedGoodsId: item.finishedGoodsId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity
          }))
        }
      },
        include: {
          SaleItem: {
            include: {
              FinishedGoods: {
                include: {
                  Design: true
                }
              }
            }
          }
        }
    });

    revalidatePath('/catalogue');
    revalidatePath('/sales');

    return {
      id: salesOrder.id,
      orderNumber: `SO-${salesOrder.id.slice(-6).toUpperCase()}`,
      totalAmount,
      itemCount: data.items.length
    };
  });
}

export async function getSalesOrders(role?: string) {
  const user = await requireAuth();
  const effectiveRole = role || user.role;

  // Sales staff see their own orders, admins/managers see all
  const whereClause = effectiveRole === 'SALES'
    ? { /* Would need user relation - for now show all */ }
    : {};

  const orders = await prisma.saleOrder.findMany({
    where: whereClause,
    include: {
      Customer: true,
      SaleItem: {
        include: {
          FinishedGoods: {
            include: {
              Design: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return orders.map(order => ({
    id: order.id,
    orderNumber: `SO-${order.id.slice(-6).toUpperCase()}`,
    customerName: order.Customer?.name || order.customerName,
    status: order.status,
    amount: Number(order.totalAmount),
    itemCount: order.SaleItem.length,
    totalQuantity: order.SaleItem.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: order.createdAt,
    items: order.SaleItem.map(item => ({
      id: item.id,
      designName: item.FinishedGoods?.Design?.name || 'Unknown',
      designCode: item.FinishedGoods?.Design?.code || 'N/A',
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice)
    }))
  }));
}

export async function confirmSalesOrder(orderId: string) {
  const user = await requireAuth();

  // Only admins and managers can confirm orders
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only managers can confirm orders');
  }

  const order = await prisma.saleOrder.findUnique({
    where: { id: orderId }
  });

  if (!order || order.status !== 'PENDING') {
    throw new Error('Order not found or not in pending status');
  }

  await prisma.saleOrder.update({
    where: { id: orderId },
    data: { status: 'CONFIRMED' }
  });

  revalidatePath('/sales');

  return { success: true };
}

export async function cancelSalesOrder(orderId: string) {
  const user = await requireAuth();

  // Only admins and managers can cancel orders
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only managers can cancel orders');
  }

  const order = await prisma.saleOrder.findUnique({
    where: { id: orderId }
  });

  if (!order || order.status === 'SHIPPED') {
    throw new Error('Order not found or cannot be cancelled');
  }

  await prisma.saleOrder.update({
    where: { id: orderId },
    data: { status: 'CANCELLED' }
  });

  revalidatePath('/sales');

  return { success: true };
}