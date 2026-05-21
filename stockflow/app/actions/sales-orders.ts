"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from 'next/cache';

export async function createSalesOrder(data: {
  customerId?: string;
  customerName: string;
  items: {
    finishedGoodsId?: string;
    productId?: string;
    quantity: number;
    unitPrice: number;
    source?: 'manufactured' | 'product';
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
    if (!item.finishedGoodsId && !item.productId) {
      throw new Error('Each item must reference either a finished good or a product');
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
    // Ensure placeholder design exists for non-manufactured product shadows
    let placeholderDesignId: string
    const existingDesign = await tx.design.findUnique({ where: { code: 'IMPORTED' } })
    if (existingDesign) {
      placeholderDesignId = existingDesign.id
    } else {
      const d = await tx.design.create({
        data: {
          name: 'Manual sale placeholder',
          code: 'IMPORTED',
          description: 'Placeholder design used when recording sales of non-manufactured items.',
        },
      })
      placeholderDesignId = d.id
    }

    // Resolve every line to a valid finishedGoodsId (creating shadow records for general Products)
    const resolvedItems = await Promise.all(
      data.items.map(async (item) => {
        let fgId = item.finishedGoodsId

        if (!fgId && item.productId) {
          // General Product → create/lookup shadow FinishedGoods
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, sku: true, name: true, unitCost: true },
          })
          if (!product) throw new Error('Referenced product not found')

          const fgSku = product.sku || `PROD-${product.id.slice(0, 8)}`
          let fg = await tx.finishedGoods.findUnique({ where: { sku: fgSku } })

          if (!fg) {
            fg = await tx.finishedGoods.create({
              data: {
                sku: fgSku,
                designId: placeholderDesignId,
                quantity: 0,
                kgProduced: 0,
                unitCost: item.unitPrice ?? product.unitCost ?? 0,
              },
            })
          }
          fgId = fg.id
        }

        if (!fgId) throw new Error('Could not resolve item to a finished good')

        // Validate stock for manufactured items (shadow items have qty=0 and are decremented on Product instead)
        if (item.source !== 'product') {
          const fg = await tx.finishedGoods.findUnique({
            where: { id: fgId },
            include: { Design: true },
          })
          if (!fg || fg.quantity < item.quantity) {
            throw new Error(`Insufficient stock for ${fg?.Design?.name || 'item'}`)
          }
        }

        return {
          finishedGoodsId: fgId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }
      })
    )

    // Calculate totals
    const totalAmount = data.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    // Create the sales order
    const salesOrder = await tx.saleOrder.create({
      data: {
        customerId: data.customerId,
        customerName: data.customerName,
        totalAmount,
        status: 'PENDING',
        SaleItem: {
          create: resolvedItems.map(item => ({
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
              design: true
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
      designName: item.FinishedGoods?.design?.name || 'Unknown',
      designCode: item.FinishedGoods?.design?.code || 'N/A',
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