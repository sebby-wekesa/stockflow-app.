'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'
import { withRetry } from '@/lib/prisma'
import { normalizeBranchCode } from '@/lib/branches'

// ─────────────────────────────────────────────────────────────────────────────
// STOCK TRANSFER
//
// Product.currentStock is the organization-wide total. ProductBranchStock
// keeps the branch-level balance so a partial transfer can move stock without
// moving or duplicating the product catalog row.
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
  const sourceBranchCode = normalizeBranchCode(data.source_branch)
  const destBranchCode = normalizeBranchCode(data.dest_branch)

  if (!sourceBranchCode) {
    throw new Error(`Source branch "${data.source_branch}" not found`)
  }
  if (!destBranchCode) {
    throw new Error(`Destination branch "${data.dest_branch}" not found`)
  }
  if (sourceBranchCode === destBranchCode) {
    throw new Error('Source and destination branches must be different')
  }

  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  // Resolve branches in our org (wrapped for pooler resilience)
  const branches = await withRetry(() =>
    db.branch.findMany({
      select: { id: true, name: true, code: true, location: true },
    })
  )
  const sourceBranch = branches.find(
    (branch) => normalizeBranchCode(branch.code, branch.name, branch.location) === sourceBranchCode
  )
  const destBranch = branches.find(
    (branch) => normalizeBranchCode(branch.code, branch.name, branch.location) === destBranchCode
  )

  if (!sourceBranch) {
    throw new Error(`Source branch "${data.source_branch}" not found`)
  }
  if (!destBranch) {
    throw new Error(`Destination branch "${data.dest_branch}" not found`)
  }

  if (!['ADMIN', 'MANAGER'].includes(user.role) && !user.branches.some((branch) => branch.id === sourceBranch.id)) {
    throw new Error('You can only transfer stock from your assigned branch')
  }

  const product = await db.product.findFirst({
    where: {
      id: data.product_id,
      OR: [
        { branchId: { in: [sourceBranch.id, sourceBranch.code, sourceBranchCode] } },
        {
          branchStocks: {
            some: {
              branchId: sourceBranch.id,
              organizationId: user.organizationId,
            },
          },
        },
      ],
    },
    select: { id: true, sku: true, name: true, currentStock: true, branchId: true },
  })
  if (!product) throw new Error('Product not found')

  const reference = `TRANSFER-${Date.now().toString(36).toUpperCase()}`

  await withTenantTransaction(user.organizationId, async (tx) => {
    // Older product rows only have the global currentStock value. Lazily seed
    // their source-branch balance the first time they participate in a
    // transfer; all subsequent transfers use the branch balance directly.
    const sourceStock = await tx.productBranchStock.upsert({
      where: {
        branchId_productId: {
          branchId: sourceBranch.id,
          productId: product.id,
        },
      },
      update: {},
      create: {
        productId: product.id,
        branchId: sourceBranch.id,
        availableQty: [sourceBranch.id, sourceBranch.code, sourceBranchCode].includes(product.branchId ?? '')
          ? product.currentStock
          : 0,
      },
    })

    const decremented = await tx.productBranchStock.updateMany({
      where: {
        id: sourceStock.id,
        availableQty: { gte: data.qty },
      },
      data: { availableQty: { decrement: data.qty } },
    })
    if (decremented.count === 0) {
      throw new Error(
        `Insufficient stock at ${sourceBranch.name}: need ${data.qty}`
      )
    }

    await tx.productBranchStock.upsert({
      where: {
        branchId_productId: {
          branchId: destBranch.id,
          productId: product.id,
        },
      },
      update: { availableQty: { increment: data.qty } },
      create: {
        productId: product.id,
        branchId: destBranch.id,
        availableQty: data.qty,
      },
    })

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

export async function searchProductsWithStock(query: string, branchValue: string) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  if (!query || query.length < 2) return []

  const branchCode = normalizeBranchCode(branchValue)
  if (!branchCode) return []

  const branches = await db.branch.findMany({
    select: { id: true, name: true, code: true, location: true },
  })
  const branch = branches.find(
    (candidate) => normalizeBranchCode(candidate.code, candidate.name, candidate.location) === branchCode
  )
  if (!branch) return []

  if (!['ADMIN', 'MANAGER'].includes(user.role) && !user.branches.some((userBranch) => userBranch.id === branch.id)) {
    return []
  }

  const products = await db.product.findMany({
    where: {
      branchId: { in: [branch.id, branch.code, branchCode] },
      currentStock: { gt: 0 },
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
