'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import type { BranchEnum, SaleStatus } from '@prisma/client'

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  notes: z.string().max(500).optional().nullable(),
})

const orderSchema = z.object({
  branch: z.enum(['mombasa', 'nairobi', 'bonje']),
  customerId: z.string().optional().nullable(),
  customerName: z.string().min(1).max(200),
  orderDate: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
  action: z.enum(['draft', 'invoice']),
  lines: z.array(lineSchema).min(1),
})

async function requireUser() {
  const supabase = await createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')
  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')
  if (!['ADMIN', 'MANAGER', 'SALES'].includes(user.role)) throw new Error('Insufficient permissions')
  return user
}

async function getBranchId(branch: BranchEnum) {
  const branchRec = await prisma.branch.findUnique({ where: { branch }, select: { id: true } })
  if (!branchRec) throw new Error(`Branch ${branch} is not configured`)
  return branchRec.id
}

export async function createSalesOrder(formData: FormData) {
  const user = await requireUser()
  const lines: Array<z.infer<typeof lineSchema>> = []
  let i = 0
  while (formData.has(`line_${i}_product_id`)) {
    lines.push({
      productId: String(formData.get(`line_${i}_product_id`)),
      quantity: Number(formData.get(`line_${i}_qty`)),
      unitPrice: Number(formData.get(`line_${i}_unit_price`)),
      notes: (formData.get(`line_${i}_notes`) as string) || null,
    })
    i++
  }

  const parsed = orderSchema.safeParse({
    branch: formData.get('branch'),
    customerId: formData.get('customer_id') || null,
    customerName: formData.get('customer_name'),
    orderDate: formData.get('invoice_date'),
    notes: formData.get('notes') || null,
    action: formData.get('action') ?? 'invoice',
    lines,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)
  const data = parsed.data
  const branchId = await getBranchId(data.branch)
  const status: SaleStatus = data.action === 'invoice' ? 'INVOICED' : 'DRAFT'

  const customerId = data.customerId || (await prisma.customer.create({
    data: { name: data.customerName, contactInfo: 'Auto-created from sale' },
    select: { id: true },
  })).id

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.saleOrder.create({
      data: {
        orderNumber: status === 'INVOICED' ? `INV-${Date.now().toString().slice(-8)}` : `DRAFT-${Date.now().toString().slice(-8)}`,
        branch: data.branch,
        customerId,
        status,
        orderDate: data.orderDate,
        salesRepId: user.id,
        notes: data.notes,
        totalAmount: 0,
      },
    })

    let total = 0
    for (const line of data.lines) {
      const lineTotal = line.quantity * line.unitPrice
      total += lineTotal
      await tx.saleOrderLine.create({
        data: {
          saleOrderId: created.id,
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: lineTotal,
        },
      })

      if (status === 'INVOICED') {
        await tx.branchStock.upsert({
          where: { productId_branch: { productId: line.productId, branch: data.branch } },
          update: { qty: { decrement: line.quantity } },
          create: { productId: line.productId, branch: data.branch, qty: -line.quantity },
        })
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            branchId,
            qty: -line.quantity,
            type: 'sale_out',
            reference: created.orderNumber ?? created.id,
            notes: line.notes ?? data.notes ?? undefined,
            userId: user.id,
          },
        })
      }
    }

    await tx.saleOrder.update({ where: { id: created.id }, data: { totalAmount: total } })
    return created
  })

  revalidatePath('/sales')
  revalidatePath('/stock')
  redirect(`/sales/${order.id}`)
}

export async function searchProductsForSale(query: string, branch: BranchEnum) {
  await requireUser()
  if (!query || query.length < 2) return []
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [{ code: { contains: query, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }],
    },
    include: { branchStocks: { where: { branch } } },
    take: 10,
    orderBy: { code: 'asc' },
  })
  return products.map((p) => ({
    id: p.id,
    product_code: p.code,
    canonical_name: p.name,
    uom: p.uom ?? 'pcs',
    category: p.category,
    selling_price: p.sellingPrice ?? 0,
    stock_at_branch: p.isService ? null : (p.branchStocks[0]?.qty ?? 0),
  }))
}

export async function confirmDraft(orderId: string) {
  const user = await requireUser()
  const order = await prisma.saleOrder.findUnique({ where: { id: orderId }, include: { lines: true } })
  if (!order || order.status !== 'DRAFT') throw new Error('Only draft orders can be confirmed')
  const branchId = await getBranchId(order.branch)

  await prisma.$transaction(async (tx) => {
    await tx.saleOrder.update({ where: { id: orderId }, data: { status: 'INVOICED', orderNumber: `INV-${Date.now().toString().slice(-8)}` } })
    for (const line of order.lines) {
      await tx.branchStock.upsert({
        where: { productId_branch: { productId: line.productId, branch: order.branch } },
        update: { qty: { decrement: line.quantity } },
        create: { productId: line.productId, branch: order.branch, qty: -line.quantity },
      })
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          branchId,
          qty: -line.quantity,
          type: 'sale_out',
          reference: order.orderNumber ?? order.id,
          userId: user.id,
        },
      })
    }
  })

  revalidatePath('/sales')
  revalidatePath(`/sales/${orderId}`)
  revalidatePath('/stock')
}

export async function cancelOrder(orderId: string, reason: string) {
  const user = await requireUser()
  if (!reason || reason.trim().length < 3) throw new Error('Cancellation reason is required')
  const order = await prisma.saleOrder.findUnique({ where: { id: orderId }, include: { lines: true } })
  if (!order) throw new Error('Order not found')
  const branchId = await getBranchId(order.branch)

  await prisma.$transaction(async (tx) => {
    if (order.status === 'INVOICED') {
      for (const line of order.lines) {
        await tx.branchStock.upsert({
          where: { productId_branch: { productId: line.productId, branch: order.branch } },
          update: { qty: { increment: line.quantity } },
          create: { productId: line.productId, branch: order.branch, qty: line.quantity },
        })
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            branchId,
            qty: line.quantity,
            type: 'sale_return',
            reference: order.orderNumber ?? order.id,
            notes: reason,
            userId: user.id,
          },
        })
      }
    }
    await tx.saleOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', notes: order.notes ? `${order.notes}\n[Cancelled] ${reason}` : `[Cancelled] ${reason}` },
    })
  })

  revalidatePath('/sales')
  revalidatePath(`/sales/${orderId}`)
  revalidatePath('/stock')
}
