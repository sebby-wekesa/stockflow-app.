'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import { nextInvoiceNumber } from '@/lib/sales'
import type { Branch } from '@prisma/client'

async function requireUser() {
  const supabase = createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')
  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')
  return user
}

async function requireBranchAccess(branch: Branch) {
  const user = await requireUser()
  if (user.role !== 'admin' && !user.branches.includes(branch)) {
    throw new Error(`You don't have access to ${branch}`)
  }
  return user
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE & INVOICE — single action that creates the order and commits stock
// ─────────────────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  product_id: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative(),
  notes: z.string().max(500).optional().nullable(),
})

const orderSchema = z.object({
  branch: z.enum(['mombasa', 'nairobi', 'bonje']),
  customer_id: z.string().optional().nullable(),
  customer_name: z.string().min(1).max(200),
  invoice_date: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
  action: z.enum(['draft', 'invoice']),
  lines: z.array(lineSchema).min(1, 'Add at least one line item'),
})

export async function createSalesOrder(formData: FormData) {
  // Form data uses indexed line keys: line_0_product_id, line_0_qty, etc.
  // Reconstruct the lines array
  const lines: any[] = []
  let i = 0
  while (formData.has(`line_${i}_product_id`)) {
    lines.push({
      product_id: formData.get(`line_${i}_product_id`),
      qty: formData.get(`line_${i}_qty`),
      unit_price: formData.get(`line_${i}_unit_price`),
      notes: formData.get(`line_${i}_notes`) || null,
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
  const user = await requireBranchAccess(data.branch as Branch)
  const action = data.action

  // Pre-flight: check that all products exist, get their categories and confirm stock
  const productIds = data.lines.map((l) => l.product_id)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, product_code: true, canonical_name: true, category: true, uom: true },
  })

  if (products.length !== data.lines.length) {
    throw new Error('One or more products not found')
  }

  const productMap = new Map(products.map((p) => [p.id, p]))

  // For invoiced orders, verify stock availability for stock-bearing categories
  if (action === 'invoice') {
    for (const line of data.lines) {
      const product = productMap.get(line.product_id)!
      if (product.category === 'service') continue // services don't deduct stock

      const stock = await prisma.branchStock.findUnique({
        where: {
          product_id_branch: { product_id: line.product_id, branch: data.branch as Branch },
        },
      })
      if (!stock || stock.qty < line.qty) {
        throw new Error(
          `Insufficient stock for ${product.product_code}: have ${stock?.qty ?? 0}, need ${line.qty}`
        )
      }
    }
  }

  // Generate invoice number for invoiced orders, draft placeholder for drafts
  const orderNumber = action === 'invoice'
    ? await nextInvoiceNumber(data.branch as Branch)
    : `DRAFT-${Date.now().toString(36).toUpperCase()}`

  // Write everything in a single transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the SalesOrder
    const order = await tx.salesOrder.create({
      data: {
        order_number: orderNumber,
        customer_id: data.customer_id || null,
        customer_name: data.customer_name,
        branch: data.branch as Branch,
        status: action === 'invoice' ? 'invoiced' : 'draft',
        invoice_date: data.invoice_date,
        notes: data.notes,
        source: 'manual',
        created_by: user.id,
      },
    })

    // 2. Create each line + (if invoiced) decrement stock + write movement
    for (const line of data.lines) {
      const product = productMap.get(line.product_id)!
      const totalAmount = line.unit_price * line.qty

      await tx.salesOrderLine.create({
        data: {
          sales_order_id: order.id,
          product_id: line.product_id,
          product_name: product.canonical_name,
          qty: line.qty,
          uom: product.uom,
          unit_price: line.unit_price,
          total_amount: totalAmount,
          notes: line.notes,
        },
      })

      if (action === 'invoice' && product.category !== 'service') {
        // Stock movement (sales_out is negative)
        await tx.stockMovement.create({
          data: {
            product_id: line.product_id,
            movement_type: 'sales_out',
            branch: data.branch as Branch,
            qty: -line.qty,
            unit_price: line.unit_price,
            customer_name: data.customer_name,
            reference: orderNumber,
            movement_date: data.invoice_date,
            notes: line.notes,
            created_by: user.id,
          },
        })

        // Decrement branch balance
        await tx.branchStock.update({
          where: {
            product_id_branch: {
              product_id: line.product_id,
              branch: data.branch as Branch,
            },
          },
          data: { qty: { decrement: line.qty } },
        })
      }
    }

    return order
  })

  revalidatePath('/sales')
  revalidatePath('/stock')
  redirect(`/sales/${result.id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM A DRAFT — turn it into an invoice (decrements stock at this point)
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmDraft(orderId: string) {
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  })
  if (!order) throw new Error('Order not found')
  if (order.status !== 'draft') throw new Error('Only drafts can be confirmed')

  const user = await requireBranchAccess(order.branch)

  // Verify stock for every line
  for (const line of order.lines) {
    if (line.product.category === 'service') continue
    const stock = await prisma.branchStock.findUnique({
      where: { product_id_branch: { product_id: line.product_id, branch: order.branch } },
    })
    if (!stock || stock.qty < line.qty) {
      throw new Error(
        `Insufficient stock for ${line.product.product_code}: have ${stock?.qty ?? 0}, need ${line.qty}`
      )
    }
  }

  const newOrderNumber = await nextInvoiceNumber(order.branch)

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        status: 'invoiced',
        order_number: newOrderNumber,
      },
    })

    for (const line of order.lines) {
      if (line.product.category === 'service') continue
      await tx.stockMovement.create({
        data: {
          product_id: line.product_id,
          movement_type: 'sales_out',
          branch: order.branch,
          qty: -line.qty,
          unit_price: line.unit_price,
          customer_name: order.customer_name,
          reference: newOrderNumber,
          movement_date: order.invoice_date,
          notes: line.notes,
          created_by: user.id,
        },
      })
      await tx.branchStock.update({
        where: { product_id_branch: { product_id: line.product_id, branch: order.branch } },
        data: { qty: { decrement: line.qty } },
      })
    }
  })

  revalidatePath('/sales')
  revalidatePath(`/sales/${orderId}`)
  revalidatePath('/stock')
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL — only allowed for drafts and invoiced orders
// For invoiced orders, returns stock by writing reverse movements
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelOrder(orderId: string, reason: string) {
  if (!reason || reason.trim().length < 3) {
    throw new Error('Cancellation reason is required (at least 3 characters)')
  }

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  })
  if (!order) throw new Error('Order not found')
  if (order.status === 'cancelled') throw new Error('Already cancelled')
  if (order.status === 'fulfilled') throw new Error('Cannot cancel a fulfilled order')

  const user = await requireBranchAccess(order.branch)

  await prisma.$transaction(async (tx) => {
    // If it was invoiced, return the stock
    if (order.status === 'invoiced') {
      for (const line of order.lines) {
        if (line.product.category === 'service') continue
        await tx.stockMovement.create({
          data: {
            product_id: line.product_id,
            movement_type: 'return_in',
            branch: order.branch,
            qty: line.qty,
            reference: order.order_number,
            movement_date: new Date(),
            notes: `Sale cancelled: ${reason}`,
            created_by: user.id,
          },
        })
        await tx.branchStock.update({
          where: { product_id_branch: { product_id: line.product_id, branch: order.branch } },
          data: { qty: { increment: line.qty } },
        })
      }
    }

    await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        notes: order.notes
          ? `${order.notes}\n\n[Cancelled] ${reason}`
          : `[Cancelled] ${reason}`,
      },
    })
  })

  revalidatePath('/sales')
  revalidatePath(`/sales/${orderId}`)
  revalidatePath('/stock')
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH — for the line-item product picker
// ─────────────────────────────────────────────────────────────────────────────

export async function searchProductsForSale(query: string, branch: Branch) {
  await requireUser()
  if (!query || query.length < 2) return []

  const products = await prisma.product.findMany({
    where: {
      is_active: true,
      OR: [
        { product_code: { contains: query, mode: 'insensitive' } },
        { canonical_name: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 10,
    orderBy: { product_code: 'asc' },
    include: {
      stock_levels: { where: { branch } },
    },
  })

  return products.map((p) => ({
    id: p.id,
    product_code: p.product_code,
    canonical_name: p.canonical_name,
    uom: p.uom,
    category: p.category,
    selling_price: p.selling_price ? Number(p.selling_price) : 0,
    stock_at_branch: p.category === 'service' ? null : (p.stock_levels[0]?.qty ?? 0),
  }))
}
