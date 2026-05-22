'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'
import { nextInvoiceNumber } from '@/lib/sales'

// ─────────────────────────────────────────────────────────────────────────────
// SALES SCHEMA NOTES
//
// SaleOrder (id, customerId, customerName, totalAmount, status, createdBy)
//   -> SaleItem (saleOrderId, finishedGoodsId, quantity, unitPrice, totalPrice)
// SaleItem links to FinishedGoods, not Product directly. For each picked
// product we ensure a FinishedGoods shadow record exists.
// Stock decrement happens on Product.currentStock.
//
// In multitenant mode, branch codes are per-org. The form sends a string
// code (e.g. 'mombasa') and we resolve it against THIS org's Branch table.
// ─────────────────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  product_id: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative(),
  notes: z.string().max(500).optional().nullable(),
})

const orderSchema = z.object({
  branch: z.string().min(1, 'Branch is required'),
  customer_id: z.string().optional().nullable(),
  customer_name: z.string().min(1).max(200),
  invoice_date: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
  action: z.enum(['draft', 'invoice']),
  lines: z.array(lineSchema).min(1, 'Add at least one line item'),
})

export async function createSalesOrder(formData: FormData) {
  const lines: Array<{
    product_id: string
    qty: string
    unit_price: string
    notes: string | null
  }> = []
  let i = 0
  while (formData.has(`line_${i}_product_id`)) {
    lines.push({
      product_id: formData.get(`line_${i}_product_id`) as string,
      qty: formData.get(`line_${i}_qty`) as string,
      unit_price: formData.get(`line_${i}_unit_price`) as string,
      notes: (formData.get(`line_${i}_notes`) as string) || null,
    })
    i++
  }

  const raw = {
    branch: formData.get('branch'),
    customer_id: formData.get('customer_id') || null,
    customer_name: formData.get('customer_name'),
    invoice_date: formData.get('invoice_date'),
    notes: formData.get('notes') || null,
    action: formData.get('action') ?? 'invoice',
    lines,
  }

  const parsed = orderSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const data = parsed.data
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  const action = data.action

  // Resolve the branch code against our org's branches
  const branchRow = await db.branch.findFirst({
    where: {
      OR: [
        { code: { equals: data.branch, mode: 'insensitive' } },
        { name: { equals: data.branch, mode: 'insensitive' } },
      ],
    },
  })
  if (!branchRow) {
    throw new Error(`Branch "${data.branch}" not found in your organization. Add it under Settings > Branches.`)
  }

  // Fetch all products on this order in one query, scoped to our org
  const productIds = data.lines.map((l) => l.product_id)
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true, uom: true, currentStock: true },
  })

  if (products.length !== data.lines.length) {
    throw new Error('One or more products not found in your organization')
  }

  const productMap = new Map(products.map((p) => [p.id, p]))

  // Pre-flight: check stock for invoiced orders
  if (action === 'invoice') {
    for (const line of data.lines) {
      const product = productMap.get(line.product_id)!
      if (product.currentStock < Number(line.qty)) {
        throw new Error(
          `Insufficient stock for ${product.sku ?? product.name}: have ${product.currentStock}, need ${line.qty}`
        )
      }
    }
  }

  const orderNumber =
    action === 'invoice'
      ? await nextInvoiceNumber(user.organizationId, branchRow.code as any)
      : `DRAFT-${Date.now().toString(36).toUpperCase()}`

  // Ensure the "IMPORTED" placeholder Design exists for FG shadow records
  let placeholderDesignId: string
  const existingDesign = await db.design.findFirst({
    where: { code: 'IMPORTED' },
  })
  if (existingDesign) {
    placeholderDesignId = existingDesign.id
  } else {
    const d = await db.design.create({
      data: {
        name: 'Manual sale placeholder',
        code: 'IMPORTED',
        description: 'Placeholder design used when recording manual sales.',
        organizationId: user.organizationId,
      },
    })
    placeholderDesignId = d.id
  }

  const totalAmount = data.lines.reduce(
    (sum, l) => sum + Number(l.unit_price) * Number(l.qty),
    0
  )

  // Atomic write: order + items + movements + stock decrement
  const result = await withTenantTransaction(user.organizationId, async (tx) => {
    const order = await tx.saleOrder.create({
      data: {
        id: orderNumber,
        customerId: data.customer_id || null,
        customerName: data.customer_name,
        totalAmount,
        status: action === 'invoice' ? 'CONFIRMED' : 'PENDING',
        createdBy: user.id,
      },
    })

    for (const line of data.lines) {
      const product = productMap.get(line.product_id)!
      const qty = Number(line.qty)
      const unitPrice = Number(line.unit_price)

      // Ensure FinishedGoods shadow exists for this org
      const fgSku = product.sku || product.id
      let fg = await tx.finishedGoods.findFirst({ where: { sku: fgSku } })
      if (!fg) {
        fg = await tx.finishedGoods.create({
          data: {
            sku: fgSku,
            designId: placeholderDesignId,
            quantity: 0,
            kgProduced: 0,
            unitCost: unitPrice,
          },
        })
      }

      await tx.saleItem.create({
        data: {
          saleOrderId: order.id,
          finishedGoodsId: fg.id,
          quantity: qty,
          unitPrice,
          totalPrice: qty * unitPrice,
        },
      })

      if (action === 'invoice') {
        await tx.stockMovement.create({
          data: {
            productId: line.product_id,
            branchId: branchRow.id,
            movementType: 'sale',
            quantity: -qty,
            reference: orderNumber,
            notes: line.notes ?? `Sale to ${data.customer_name}`,
          },
        })

        await tx.product.update({
          where: { id: line.product_id },
          data: { currentStock: { decrement: qty } },
        })
      }
    }

    return order
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/sales')
  revalidatePath('/stock')
  redirect(`/sales/${result.id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM A DRAFT
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmDraft(orderId: string) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  const order = await db.saleOrder.findFirst({
    where: { id: orderId },
    include: { SaleItem: { include: { FinishedGoods: true } } },
  })
  if (!order) throw new Error('Order not found')
  if (order.status !== 'PENDING') {
    throw new Error('Only pending orders can be confirmed')
  }

  // Verify stock by looking up Product by FG sku
  for (const line of order.SaleItem) {
    const product = await db.product.findFirst({
      where: { sku: line.FinishedGoods.sku },
    })
    if (!product || product.currentStock < line.quantity) {
      throw new Error(
        `Insufficient stock for ${line.FinishedGoods.sku}: have ${product?.currentStock ?? 0}, need ${line.quantity}`
      )
    }
  }

  await withTenantTransaction(user.organizationId, async (tx) => {
    await tx.saleOrder.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
    })

    for (const line of order.SaleItem) {
      const product = await tx.product.findFirst({
        where: { sku: line.FinishedGoods.sku },
      })
      if (!product) continue

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          movementType: 'sale',
          quantity: -line.quantity,
          reference: order.id,
          notes: `Sale confirmed for ${order.customerName}`,
        },
      })

      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: { decrement: line.quantity } },
      })
    }
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/sales')
  revalidatePath(`/sales/${orderId}`)
  revalidatePath('/stock')
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL ORDER
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelOrder(orderId: string, reason: string) {
  if (!reason || reason.trim().length < 3) {
    throw new Error('Cancellation reason is required (at least 3 characters)')
  }

  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  const order = await db.saleOrder.findFirst({
    where: { id: orderId },
    include: { SaleItem: { include: { FinishedGoods: true } } },
  })
  if (!order) throw new Error('Order not found')
  if (order.status === 'CANCELLED') throw new Error('Already cancelled')
  if (order.status === 'SHIPPED') {
    throw new Error('Cannot cancel a shipped order')
  }

  const wasConfirmed = order.status === 'CONFIRMED'

  await withTenantTransaction(user.organizationId, async (tx) => {
    if (wasConfirmed) {
      // Return stock for confirmed orders
      for (const line of order.SaleItem) {
        const product = await tx.product.findFirst({
          where: { sku: line.FinishedGoods.sku },
        })
        if (!product) continue

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: 'return',
            quantity: line.quantity,
            reference: order.id,
            notes: `Sale cancelled: ${reason}`,
          },
        })

        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: { increment: line.quantity } },
        })
      }
    }

    await tx.saleOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    })
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/sales')
  revalidatePath(`/sales/${orderId}`)
  revalidatePath('/stock')
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH for product picker
// ─────────────────────────────────────────────────────────────────────────────

export async function searchProductsForSale(query: string, branch: string) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  if (!query || query.length < 2) return []

  // branch param accepted for backward-compat; stock is global in this schema
  void branch

  const products = await db.product.findMany({
    where: {
      OR: [
        { sku: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 10,
    orderBy: { sku: 'asc' },
  })

  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    uom: p.uom,
    currentStock: p.currentStock,
    unitCost: p.unitCost,
  }))
}
