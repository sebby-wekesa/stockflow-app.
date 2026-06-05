'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'
import { nextInvoiceNumber } from '@/lib/sales'
import { releaseSaleOrderReservation, reserveSaleOrder } from '@/lib/order-lifecycle'

// ─────────────────────────────────────────────────────────────────────────────
// SALES SCHEMA NOTES
//
// SaleOrder (id, customerId, customerName, totalAmount, status, createdBy)
//   -> SaleItem (saleOrderId, finishedGoodsId, quantity, unitPrice, totalPrice)
// SaleItem links to FinishedGoods, not Product directly. For each picked
// product we ensure a FinishedGoods shadow record exists. FinishedGoods is
// the fulfilment source of truth: confirmation reserves it and packaging
// consumes the reservation.
//
// In multitenant mode, branch codes are per-org. The form sends a string
// code (e.g. 'mombasa') and we resolve it against THIS org's Branch table.
// ─────────────────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  product_id: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative(),
  pieces_sets: z.coerce.number().int().nonnegative().optional().default(0),
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

const SALES_BRANCH_ALIASES: Record<string, string[]> = {
  mombasa: ['mombasa', 'msa', 'mombasa branch'],
  msa: ['mombasa', 'msa', 'mombasa branch'],
  nairobi: ['nairobi', 'nbo', 'nbi', 'nairobi branch'],
  nbo: ['nairobi', 'nbo', 'nbi', 'nairobi branch'],
  nbi: ['nairobi', 'nbo', 'nbi', 'nairobi branch'],
  bunje: ['bunje', 'bonje', 'bnj', 'bunje branch', 'bonje branch'],
  bonje: ['bunje', 'bonje', 'bnj', 'bunje branch', 'bonje branch'],
  bnj: ['bunje', 'bonje', 'bnj', 'bunje branch', 'bonje branch'],
}

function normalizeSalesBranch(value: string) {
  const normalized = value.trim().toLowerCase()
  if (['mombasa', 'msa'].includes(normalized)) return 'mombasa'
  if (['nairobi', 'nbo', 'nbi'].includes(normalized)) return 'nairobi'
  if (['bunje', 'bonje', 'bnj'].includes(normalized)) return 'bunje'
  return normalized
}

function getBranchLookupValues(value: string) {
  const normalized = value.trim().toLowerCase()
  return Array.from(new Set([value, normalized, ...(SALES_BRANCH_ALIASES[normalized] ?? [])]))
}

export async function createSalesOrder(formData: FormData) {
  let redirectTo: string | null = null

  try {
    const lines: Array<{
      product_id: string
      qty: string
      unit_price: string
      pieces_sets: string
      notes: string | null
    }> = []
    let i = 0
    while (formData.has(`line_${i}_product_id`)) {
      lines.push({
        product_id: formData.get(`line_${i}_product_id`) as string,
        qty: formData.get(`line_${i}_qty`) as string,
        unit_price: formData.get(`line_${i}_unit_price`) as string,
        pieces_sets: (formData.get(`line_${i}_pieces_sets`) as string) || '0',
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
      return { error: parsed.error.issues[0].message }
    }

    const data = parsed.data
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)
    const action = data.action
    const salesBranch = normalizeSalesBranch(data.branch)
    const branchLookupValues = getBranchLookupValues(data.branch)

    // Resolve the branch outside the transaction. Safe to do here because
    // branches are stable — they don't change between the lookup and the writes.
    const branchRow = await db.branch.findFirst({
      where: {
        OR: branchLookupValues.flatMap((branch) => [
          { code: { equals: branch, mode: 'insensitive' as const } },
          { name: { equals: branch, mode: 'insensitive' as const } },
          { name: { contains: branch, mode: 'insensitive' as const } },
        ]),
      },
    })
    if (!branchRow) {
      return { error: `Branch "${data.branch}" not found in your organization. Add it under Settings > Branches.` }
    }

    // Pre-compute total from form input. Qty is stock movement quantity;
    // pieces_sets is the billable pieces/sets count.
    const totalAmount = data.lines.reduce(
      (sum, l) => sum + Number(l.unit_price) * Number(l.pieces_sets),
      0
    )

    const result = await withTenantTransaction(user.organizationId, async (tx) => {
    // Fetch all products in this order (existence check)
    const productIds = data.lines.map((l) => l.product_id)
    type ProductLite = { id: string; sku: string | null; name: string; uom: string; currentStock: number; piecesSets: number }
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true, name: true, uom: true, currentStock: true, piecesSets: true },
    }) as ProductLite[]
    if (products.length !== data.lines.length) {
      throw new Error('One or more products not found in your organization')
    }
    const productMap = new Map<string, ProductLite>(products.map((p) => [p.id, p]))

    // Ensure the IMPORTED placeholder Design exists (inside the txn,
    // so concurrent invoices don't both try to create it).
    let placeholderDesign = await tx.design.findFirst({ where: { code: 'IMPORTED' } })
    if (!placeholderDesign) {
      placeholderDesign = await tx.design.create({
        data: {
          name: 'Manual sale placeholder',
          code: 'IMPORTED',
          description: 'Placeholder design used when recording manual sales.',
        },
      })
    }

    // Generate the invoice number inside the txn. Concurrent invoices in the
    // same branch are serialized by the unique constraint on (orgId, id) —
    // if a collision occurs the txn aborts and the caller retries.
    const orderNumber =
      action === 'invoice'
        ? await nextInvoiceNumber(user.organizationId, salesBranch)
        : `DRAFT-${Date.now().toString(36).toUpperCase()}`

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
      const billablePiecesSets = Number(line.pieces_sets) || 0

      // Ensure FinishedGoods shadow exists for this org
      const fgSku = product.sku || product.id
      let fg = await tx.finishedGoods.findFirst({ where: { sku: fgSku } })
      if (!fg) {
        fg = await tx.finishedGoods.create({
          data: {
            sku: fgSku,
            designId: placeholderDesign.id,
            quantity: Math.floor(product.currentStock),
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
          totalPrice: billablePiecesSets * unitPrice,
        },
      })

    }

    if (action === 'invoice') {
      const reservableOrder = await tx.saleOrder.findUnique({
        where: { id: order.id },
        include: { SaleItem: { include: { FinishedGoods: true } } },
      })
      if (!reservableOrder) throw new Error('Sales order not found after creation')
      await reserveSaleOrder(tx, { ...reservableOrder, status: 'PENDING' })
    }

    return order
    }, { maxWait: 10000, timeout: 30000 })

    revalidatePath('/sales')
    revalidatePath('/stock')
    redirectTo = `/sales/${result.id}`
  } catch (error) {
    console.error('createSalesOrder failed:', error)
    return {
      error: error instanceof Error ? error.message : 'Failed to create sales order',
    }
  }

  if (redirectTo) redirect(redirectTo)
  return { error: 'Failed to create sales order' }
}

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

  await withTenantTransaction(user.organizationId, async (tx) => {
    // Re-load the order inside the transaction to ensure the status hasn't
    // changed between the outer findFirst and the actual confirm. If a
    // parallel confirmDraft already ran, we'll see status !== PENDING and abort.
    const current = await tx.saleOrder.findFirst({
      where: { id: orderId },
      select: { status: true },
    })
    if (!current || current.status !== 'PENDING') {
      throw new Error('Order is no longer pending (may have been confirmed or cancelled by another action)')
    }

    await reserveSaleOrder(tx, order)
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/sales')
  revalidatePath(`/sales/${orderId}`)
  revalidatePath('/stock')
}

export async function updateDraftSalesOrder(formData: FormData) {
  const orderId = String(formData.get('order_id') || '')
  const customerName = String(formData.get('customer_name') || '').trim()
  const confirmAfterSave = formData.get('confirm_after_save') === 'true'

  if (!orderId) return { error: 'Order is required' }
  if (!customerName) return { error: 'Customer name is required' }

  const lines: Array<{
    id: string
    quantity: number
    unitPrice: number
    piecesSets: number
  }> = []
  let i = 0
  while (formData.has(`line_${i}_id`)) {
    const id = String(formData.get(`line_${i}_id`) || '')
    const quantity = Number(formData.get(`line_${i}_quantity`))
    const unitPrice = Number(formData.get(`line_${i}_unit_price`))
    const piecesSets = Number(formData.get(`line_${i}_pieces_sets`))
    if (!id) return { error: 'Invalid line item' }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: 'Quantity must be a positive whole number' }
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { error: 'Unit price cannot be negative' }
    }
    if (!Number.isFinite(piecesSets) || piecesSets < 0) {
      return { error: 'Sets/pcs cannot be negative' }
    }
    lines.push({ id, quantity, unitPrice, piecesSets })
    i++
  }

  if (lines.length === 0) return { error: 'Add at least one line item' }

  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    const existing = await db.saleOrder.findFirst({
      where: { id: orderId },
      include: { SaleItem: { select: { id: true } } },
    })
    if (!existing) return { error: 'Order not found' }
    if (existing.status !== 'PENDING') return { error: 'Only draft orders can be edited' }

    const existingLineIds = new Set(existing.SaleItem.map((line) => line.id))
    if (lines.some((line) => !existingLineIds.has(line.id))) {
      return { error: 'One or more line items do not belong to this order' }
    }

    await withTenantTransaction(user.organizationId, async (tx) => {
      const current = await tx.saleOrder.findFirst({
        where: { id: orderId },
        include: { SaleItem: { include: { FinishedGoods: true } } },
      })
      if (!current) throw new Error('Order not found')
      if (current.status !== 'PENDING') throw new Error('Only draft orders can be edited')

      const totalAmount = lines.reduce((sum, line) => sum + line.unitPrice * line.piecesSets, 0)

      await tx.saleOrder.update({
        where: { id: orderId },
        data: { customerName, totalAmount },
      })

      for (const line of lines) {
        await tx.saleItem.update({
          where: { id: line.id },
          data: {
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: line.unitPrice * line.piecesSets,
          },
        })
      }

      if (confirmAfterSave) {
        const updated = await tx.saleOrder.findFirst({
          where: { id: orderId },
          include: { SaleItem: { include: { FinishedGoods: true } } },
        })
        if (!updated) throw new Error('Order not found after update')
        await reserveSaleOrder(tx, updated)
      }
    }, { maxWait: 10000, timeout: 30000 })

    revalidatePath('/sales')
    revalidatePath(`/sales/${orderId}`)
    revalidatePath('/stock')
    return { success: true }
  } catch (error) {
    console.error('updateDraftSalesOrder failed:', error)
    return {
      error: error instanceof Error ? error.message : 'Failed to update draft order',
    }
  }
}

export async function deleteDraftSalesOrder(orderId: string) {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    const order = await db.saleOrder.findFirst({
      where: { id: orderId },
      select: { id: true, status: true },
    })
    if (!order) return { error: 'Order not found' }
    if (order.status !== 'PENDING') {
      return { error: 'Only draft invoices can be deleted' }
    }

    await db.saleOrder.delete({
      where: { id: orderId },
    })

    revalidatePath('/sales')
    return { success: true }
  } catch (error) {
    console.error('deleteDraftSalesOrder failed:', error)
    return {
      error: error instanceof Error ? error.message : 'Failed to delete draft invoice',
    }
  }
}

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
  if (order.status === 'SHIPPED' || order.status === 'READY_FOR_DISPATCH') {
    throw new Error('Cannot cancel an order after packaging')
  }

  await withTenantTransaction(user.organizationId, async (tx) => {
    // Re-check the status inside the transaction so we don't race with
    // another confirmDraft / cancelOrder running in parallel.
    const current = await tx.saleOrder.findFirst({
      where: { id: orderId },
      select: { status: true },
    })
    if (!current) throw new Error('Order not found')
    if (current.status === 'CANCELLED') throw new Error('Already cancelled')
    if (current.status === 'SHIPPED' || current.status === 'READY_FOR_DISPATCH') {
      throw new Error('Cannot cancel an order after packaging')
    }
    const activeProductionOrders = await tx.productionOrder.count({
      where: {
        saleOrderId: orderId,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
      },
    })
    if (activeProductionOrders > 0) {
      throw new Error('Cancel or complete linked production orders before cancelling this sale')
    }

    await releaseSaleOrderReservation(tx, { ...order, status: current.status })

    await tx.saleOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    })
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/sales')
  revalidatePath(`/sales/${orderId}`)
  revalidatePath('/stock')
}

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

  const finishedGoods = await db.finishedGoods.findMany({
    where: { sku: { in: products.map((product) => product.sku).filter(Boolean) as string[] } },
    select: { sku: true, quantity: true },
  })
  const availableBySku = new Map(finishedGoods.map((item) => [item.sku, item.quantity]))

  return products.map((p) => ({
    id: p.id,
    product_code: p.sku,
    canonical_name: p.name,
    uom: p.uom,
    category: p.category,
    selling_price: p.unitCost ?? 0,
    stock_at_branch: p.sku && availableBySku.has(p.sku)
      ? availableBySku.get(p.sku)!
      : p.currentStock,
    piecesSets: p.piecesSets ?? 0,
  }))
}
