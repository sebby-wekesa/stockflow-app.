"use server";

import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { revalidatePath } from 'next/cache';
import { releaseSaleOrderReservation, reserveSaleOrder } from '@/lib/order-lifecycle';
import { postSaleToLedger, voidSalePosting } from '@/lib/accounting/sales-posting';

export async function createSalesOrder(data: {
  customerId?: string;
  customerName: string;
  saleDate?: string;
  items: {
    finishedGoodsId?: string;
    productId?: string;
    designId?: string;
    quantity: number;
    unitPrice: number;
    piecesSets?: number;
    source?: 'manufactured' | 'product' | 'design';
  }[];
}) {
  // Validate input data
  if (!data.customerName || data.customerName.trim().length === 0) {
    throw new Error('Customer name is required');
  }

  if (!data.items || data.items.length === 0) {
    throw new Error('At least one item is required');
  }

  const saleDate = data.saleDate
    ? new Date(`${data.saleDate}T00:00:00.000Z`)
    : new Date()
  if (Number.isNaN(saleDate.getTime())) {
    throw new Error('Sale date must be valid');
  }

  for (const item of data.items) {
    if (!item.finishedGoodsId && !item.productId && !item.designId) {
      throw new Error('Each item must reference a finished good, product, or design');
    }
    if (item.quantity <= 0) {
      throw new Error('Item quantities must be positive');
    }
    if (item.unitPrice < 0) {
      throw new Error('Item unit prices cannot be negative');
    }
    if (item.piecesSets != null && (!Number.isFinite(item.piecesSets) || item.piecesSets < 0)) {
      throw new Error('Pieces/sets must be zero or greater');
    }
  }

  const user = await requireActiveAuth();
  // Only sales staff, admins, and managers can create sales orders
  if (user.role !== 'SALES' && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only sales staff can create orders');
  }

  // Use tenant-scoped transaction for atomic order creation
  return await withTenantTransaction(user.organizationId, async (tx) => {
    // Ensure placeholder design exists for non-manufactured product shadows
    let placeholderDesignId: string
    const existingDesign = await tx.design.findUnique({
      where: {
        organizationId_code: {
          organizationId: user.organizationId,
          code: 'IMPORTED',
        },
      },
    })
    if (existingDesign) {
      placeholderDesignId = existingDesign.id
    } else {
      const d = await tx.design.create({
        data: {
          organizationId: user.organizationId,
          name: 'Manual sale placeholder',
          code: 'IMPORTED',
          description: 'Placeholder design used when recording sales of non-manufactured items.',
        },
      })
      placeholderDesignId = d.id
    }

    // Resolve every line to a valid finishedGoodsId. Made-to-order design
    // lines get a zero-stock FinishedGoods placeholder so the sale line can
    // be linked immediately, then production fills that exact record.
    const resolvedItems = await Promise.all(
      data.items.map(async (item) => {
        let fgId = item.finishedGoodsId
        let designId = item.designId
        let requiresProduction = item.source === 'design'
        let targetKg = 0

        if (!fgId && item.productId) {
          // General Product → create/lookup shadow FinishedGoods
          const product = await tx.product.findFirst({
            where: { id: item.productId },
            select: { id: true, sku: true, name: true, unitCost: true, currentStock: true },
          })
          if (!product) throw new Error('Referenced product not found')

          const fgSku = product.sku || `PROD-${product.id.slice(0, 8)}`
          let fg = await tx.finishedGoods.findUnique({
            where: {
              organizationId_sku: {
                organizationId: user.organizationId,
                sku: fgSku,
              },
            },
          })

          if (!fg) {
            fg = await tx.finishedGoods.create({
              data: {
                organizationId: user.organizationId,
                sku: fgSku,
                designId: placeholderDesignId,
                quantity: Math.floor(product.currentStock),
                kgProduced: 0,
                unitCost: item.unitPrice ?? product.unitCost ?? 0,
              },
            })
          }
          fgId = fg.id
        }

        if (!fgId && item.designId) {
          const design = await tx.design.findFirst({
            where: { id: item.designId },
            include: {
              stages: { orderBy: { sequence: 'asc' } },
              billOfMaterials: true,
            },
          })
          if (!design) throw new Error('Referenced design not found')
          if (design.stages.length === 0) {
            throw new Error(`Design "${design.name}" has no production stages configured`)
          }
          if (!design.targetWeight || Number(design.targetWeight) <= 0) {
            throw new Error(`Design "${design.name}" is missing kg per unit`)
          }
          if (design.billOfMaterials.length === 0) {
            throw new Error(`Design "${design.name}" has no raw material BOM configured`)
          }

          targetKg = Number(design.targetWeight) * item.quantity
          const fg = await tx.finishedGoods.create({
            data: {
              organizationId: user.organizationId,
              sku: `MTO-${design.code}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
              designId: design.id,
              quantity: 0,
              kgProduced: 0,
              unitCost: item.unitPrice,
            },
          })

          fgId = fg.id
          designId = design.id
          requiresProduction = true
        }

        if (!fgId) throw new Error('Could not resolve item to a finished good')

        // Validate stock for manufactured items (shadow items have qty=0 and are decremented on Product instead)
        if (item.source !== 'product' && item.source !== 'design') {
          const fg = await tx.finishedGoods.findFirst({
            where: { id: fgId },
            include: { design: true },
          })
          if (!fg || fg.quantity < item.quantity) {
            throw new Error(`Insufficient stock for ${fg?.design?.name || 'item'}`)
          }
        }

        return {
          finishedGoodsId: fgId,
          designId,
          requiresProduction,
          targetKg,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          piecesSets: item.piecesSets ?? (item.source === 'product' ? item.quantity : 0),
        }
      })
    )

    // Calculate totals
    const totalAmount = data.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    // Create the sales order
    const salesOrder = await tx.saleOrder.create({
      data: {
        organizationId: user.organizationId,
        customerId: data.customerId,
        customerName: data.customerName,
        createdAt: saleDate,
        totalAmount,
        status: 'PENDING',
        SaleItem: {
          create: resolvedItems.map(item => ({
            organizationId: user.organizationId,
            finishedGoodsId: item.finishedGoodsId,
            quantity: item.quantity,
            piecesSets: item.piecesSets,
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
              design: true
            }
          }
            }
          }
        }
    });

    for (const item of resolvedItems) {
      if (!item.requiresProduction || !item.designId) continue

      const saleItem = salesOrder.SaleItem.find((line: any) =>
        line.finishedGoodsId === item.finishedGoodsId
      )
      if (!saleItem) throw new Error('Could not link sale item to production order')

      const design = await tx.design.findFirst({
        where: { id: item.designId },
        include: { stages: { orderBy: { sequence: 'asc' } } },
      })
      if (!design || design.stages.length === 0) {
        throw new Error('Design no longer has production stages configured')
      }

      await tx.productionOrder.create({
        data: {
          organizationId: user.organizationId,
          saleOrderId: salesOrder.id,
          saleItemId: saleItem.id,
          orderNumber: `PO-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          designId: item.designId,
          quantity: item.quantity,
          targetKg: item.targetKg,
          priority: 'MEDIUM',
          status: 'PENDING',
          currentStage: design.stages[0].sequence,
          currentDept: design.stages[0].department,
        },
      })
    }

    revalidatePath('/catalogue');
    revalidatePath('/sales');
    revalidatePath('/approvals');
    revalidatePath('/jobs');

    return {
      id: salesOrder.id,
      orderNumber: `SO-${salesOrder.id.slice(-6).toUpperCase()}`,
      totalAmount,
      itemCount: data.items.length
    };
  });
}

export async function getSalesOrders(role?: string, limit?: number) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);
  const effectiveRole = role || user.role;

  // Sales staff see their own orders, admins/managers see all
  const whereClause = effectiveRole === 'SALES'
    ? { createdBy: user.id }
    : {};

  const orders = await db.saleOrder.findMany({
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
    orderBy: { createdAt: 'desc' },
    take: limit ?? undefined
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
      piecesSets: item.piecesSets,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice)
    }))
  }));
}

export async function confirmSalesOrder(orderId: string) {
  const user = await requireActiveAuth();
  // Only admins and managers can confirm orders
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only managers can confirm orders');
  }

  await withTenantTransaction(user.organizationId, async (tx) => {
    const order = await tx.saleOrder.findFirst({
      where: { id: orderId },
      include: { SaleItem: { include: { FinishedGoods: true } } },
    });

    if (!order || order.status !== 'PENDING') {
      throw new Error('Order not found or not in pending status');
    }
    const openProductionOrders = await tx.productionOrder.count({
      where: { saleOrderId: orderId, status: { not: 'COMPLETED' } },
    });
    if (openProductionOrders > 0) {
      throw new Error('Complete linked production orders before confirming this sale');
    }

    await reserveSaleOrder(tx, order, user.organizationId);
    await postSaleToLedger(tx, user.organizationId, {
      id: order.id,
      totalAmount: Number(order.totalAmount),
      date: order.createdAt,
      branchId: user.branches[0]?.id ?? null,
    }, user.id);
  });

  revalidatePath('/sales');

  return { success: true };
}

export async function cancelSalesOrder(orderId: string) {
  const user = await requireActiveAuth();
  // Only admins and managers can cancel orders
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only managers can cancel orders');
  }

  await withTenantTransaction(user.organizationId, async (tx) => {
    const order = await tx.saleOrder.findFirst({
      where: { id: orderId },
      include: { SaleItem: { include: { FinishedGoods: true } } },
    });

    if (!order || order.status === 'SHIPPED' || order.status === 'READY_FOR_DISPATCH') {
      throw new Error('Order not found or cannot be cancelled');
    }
    const activeProductionOrders = await tx.productionOrder.count({
      where: {
        saleOrderId: orderId,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
      },
    });
    if (activeProductionOrders > 0) {
      throw new Error('Cancel or complete linked production orders before cancelling this sale');
    }

    await releaseSaleOrderReservation(tx, order, user.organizationId);
    await voidSalePosting(tx, orderId);
    await tx.productionOrder.updateMany({
      where: { saleOrderId: orderId, status: { in: ['PENDING', 'APPROVED'] } },
      data: { status: 'CANCELLED' },
    });
    await tx.saleOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });
  });

  revalidatePath('/sales');

  return { success: true };
}
