"use server";

import { prisma } from "@/lib/prisma";
import { hash, compare } from "bcryptjs";
import { z } from "zod";

const customerLoginSchema = z.object({
  accessCode: z.string().min(1),
  customerCode: z.string().min(1)
});

export async function authenticateCustomer(accessCode: string, customerCode: string) {
  const validatedData = customerLoginSchema.parse({ accessCode, customerCode });

  const portalAccess = await prisma.customerPortalAccess.findUnique({
    where: {
      customerId: accessCode // This should be a unique identifier
    },
    include: {
      customer: true
    }
  });

  if (!portalAccess || !portalAccess.isActive) {
    throw new Error('Invalid access credentials');
  }

  // Verify customer code matches
  if (portalAccess.customer.code !== validatedData.customerCode) {
    throw new Error('Invalid access credentials');
  }

  // Update last login
  await prisma.customerPortalAccess.update({
    where: { id: portalAccess.id },
    data: { lastLogin: new Date() }
  });

  return {
    customerId: portalAccess.customer.id,
    customerName: portalAccess.customer.name,
    accessId: portalAccess.id
  };
}

export async function getCustomerOrders(customerId: string, accessId: string) {
  // Verify access is still valid
  const portalAccess = await prisma.customerPortalAccess.findUnique({
    where: { id: accessId }
  });

  if (!portalAccess || !portalAccess.isActive || portalAccess.customerId !== customerId) {
    throw new Error('Access denied');
  }

  const orders = await prisma.saleOrder.findMany({
    where: { customerId },
    include: {
      items: {
        include: {
          finishedGoods: {
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
    status: order.status,
    totalAmount: Number(order.totalAmount),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map(item => ({
      id: item.id,
      designName: item.finishedGoods.design.name,
      designCode: item.finishedGoods.design.code,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      barcode: item.finishedGoods.barcode
    }))
  }));
}

export async function getCustomerOrderTracking(customerId: string, accessId: string, orderId: string) {
  // Verify access
  const portalAccess = await prisma.customerPortalAccess.findUnique({
    where: { id: accessId }
  });

  if (!portalAccess || !portalAccess.isActive || portalAccess.customerId !== customerId) {
    throw new Error('Access denied');
  }

  const order = await prisma.saleOrder.findFirst({
    where: {
      id: orderId,
      customerId
    },
    include: {
      items: {
        include: {
          finishedGoods: {
            include: {
              Design: true
            }
          }
        }
      }
    }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  // Get delivery notes (this would be a separate model in production)
  // For now, return basic tracking info
  const trackingInfo = {
    orderId: order.id,
    orderNumber: `SO-${order.id.slice(-6).toUpperCase()}`,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    createdAt: order.createdAt,
    estimatedDelivery: new Date(order.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from order
    items: order.items.map(item => ({
      id: item.id,
      designName: item.finishedGoods.design.name,
      designCode: item.finishedGoods.design.code,
      quantity: item.quantity,
      status: 'Ready for shipment', // Simplified status
      trackingNumber: item.finishedGoods.barcode ? `TN-${item.finishedGoods.barcode.slice(-8)}` : null
    })),
    timeline: [
      {
        date: order.createdAt,
        status: 'Order Placed',
        description: 'Your order has been received and is being processed'
      },
      {
        date: new Date(order.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: 'Processing',
        description: 'Your items are being prepared for shipment'
      },
      {
        date: new Date(order.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000),
        status: 'Ready for Shipment',
        description: 'Your order is ready for delivery'
      }
    ].filter(event => event.date <= new Date())
  };

  return trackingInfo;
}

export async function createCustomerPortalAccess(customerId: string) {
  // Only admins can create portal access
  // This would be called from admin panel

  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Check if access already exists
  const existingAccess = await prisma.customerPortalAccess.findUnique({
    where: { customerId }
  });

  if (existingAccess) {
    throw new Error('Portal access already exists for this customer');
  }

  // Generate secure access code
  const accessCode = `CUST-${customer.code}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const portalAccess = await prisma.customerPortalAccess.create({
    data: {
      customerId,
      accessCode
    }
  });

  return {
    accessCode,
    customerName: customer.name,
    customerCode: customer.code
  };
}