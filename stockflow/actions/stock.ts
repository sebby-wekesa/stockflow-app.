'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'
import { withRetry } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// STOCK TRANSFER
//
// Note: stock is tracked on Product.currentStock globally, not per-branch.
// The "transfer" logs movements + audit entries but doesn't change
// Product.currentStock.
// ─────────────────────────────────────────────────────────────────────────────

const transferSchema = z.object({
  product_id: z.string().min(1),
  source_branch: z.string().min(1),
  dest_branch: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  notes: z.string().max(500).optional().nullable(),
})

export async function dispatchTransfer(formData: FormData) {
  const raw = {
    product_id: formData.get('product_id'),
    source_branch: formData.get('source_branch'),
    dest_branch: formData.get('dest_branch'),
    qty: formData.get('qty'),
    notes: formData.get('notes') || null,
  }

  const parsed = transferSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const data = parsed.data
  if (data.source_branch === data.dest_branch) {
    throw new Error('Source and destination branches must be different')
  }

  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  // Resolve branches in our org (wrapped for pooler resilience)
  const [sourceBranch, destBranch] = await withRetry(() =>
    Promise.all([
      db.branch.findFirst({
        where: {
          OR: [
            { code: { equals: data.source_branch, mode: 'insensitive' } },
            { name: { equals: data.source_branch, mode: 'insensitive' } },
          ],
        },
      }),
      db.branch.findFirst({
        where: {
          OR: [
            { code: { equals: data.dest_branch, mode: 'insensitive' } },
            { name: { equals: data.dest_branch, mode: 'insensitive' } },
          ],
        },
      }),
    ])
  )

  if (!sourceBranch) {
    throw new Error(`Source branch "${data.source_branch}" not found`)
  }
  if (!destBranch) {
    throw new Error(`Destination branch "${data.dest_branch}" not found`)
  }

  const product = await db.product.findFirst({
    where: { id: data.product_id },
    select: { id: true, sku: true, name: true, currentStock: true },
  })
  if (!product) throw new Error('Product not found')
  if (product.currentStock < data.qty) {
    throw new Error(
      `Insufficient stock: have ${product.currentStock}, need ${data.qty}`
    )
  }

  const reference = `TRANSFER-${Date.now().toString(36).toUpperCase()}`

  await withTenantTransaction(user.organizationId, async (tx) => {
    await tx.stockMovement.create({
      data: {
        productId: data.product_id,
        branchId: sourceBranch.id,
        movementType: 'transfer_out',
        quantity: -data.qty,
        reference,
        notes: data.notes ?? `Transfer to ${destBranch.name}`,
      },
    })

    await tx.stockMovement.create({
      data: {
        productId: data.product_id,
        branchId: destBranch.id,
        movementType: 'transfer_in',
        quantity: data.qty,
        reference,
        notes: data.notes ?? `Transfer from ${sourceBranch.name}`,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'STOCK_TRANSFER',
        entityType: 'Product',
        entityId: data.product_id,
        details: `Transferred ${data.qty} ${product.sku ?? product.name} from ${sourceBranch.name} to ${destBranch.name}. ${data.notes ?? ''}`,
      },
    })
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/stock')
  revalidatePath('/stock/transfer')
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH PRODUCTS WITH STOCK
// ─────────────────────────────────────────────────────────────────────────────

export async function searchProductsWithStock(query: string, _branch: string) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  if (!query || query.length < 2) return []

  // _branch param accepted for backward-compat; stock is global in this schema
  void _branch

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
    product_code: p.sku,
    canonical_name: p.name,
    uom: p.uom,
    stock_at_branch: p.currentStock,
  }))
}
