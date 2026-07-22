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
  qty: z.coerce.number().positive(),
  quantity_unit: z.enum(['KG', 'PCS_SETS']).default('KG'),
  notes: z.string().max(500).optional().nullable(),
})

export async function dispatchTransfer(formData: FormData) {
  const raw = {
    product_id: formData.get('product_id'),
    source_branch: formData.get('source_branch'),
    dest_branch: formData.get('dest_branch'),
    qty: formData.get('qty'),
    quantity_unit: formData.get('quantity_unit') || 'KG',
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
    select: { id: true, sku: true, name: true, currentStock: true, piecesSets: true, branchId: true },
  })
  if (!product) throw new Error('Product not found')

  const reference = `TRANSFER-${Date.now().toString(36).toUpperCase()}`
  const quantityLabel = data.quantity_unit === 'KG' ? 'KG' : 'PCS/Sets'

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
        availablePiecesSets: [sourceBranch.id, sourceBranch.code, sourceBranchCode].includes(product.branchId ?? '')
          ? product.piecesSets
          : 0,
      },
    })

    const decremented = await tx.productBranchStock.updateMany({
      where: {
        id: sourceStock.id,
        ...(data.quantity_unit === 'KG'
          ? { availableQty: { gte: data.qty } }
          : { availablePiecesSets: { gte: data.qty } }),
      },
      data: data.quantity_unit === 'KG'
        ? { availableQty: { decrement: data.qty } }
        : { availablePiecesSets: { decrement: data.qty } },
    })
    if (decremented.count === 0) {
      throw new Error(
        `Insufficient ${quantityLabel} stock at ${sourceBranch.name}: need ${data.qty}`
      )
    }

    await tx.stockMovement.create({
      data: {
        productId: data.product_id,
        branchId: sourceBranch.id,
        movementType: 'transfer_out',
        quantity: -data.qty,
        reference,
        notes: `${quantityLabel} · ${data.notes ?? `Dispatched to ${destBranch.name}`}`,
      },
    })

    await tx.stockTransfer.create({
      data: {
        reference,
        productId: product.id,
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destBranch.id,
        quantity: data.qty,
        quantityUnit: data.quantity_unit,
        notes: data.notes ?? null,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'STOCK_TRANSFER_DISPATCHED',
        entityType: 'StockTransfer',
        entityId: data.product_id,
        details: `Dispatched ${data.qty} ${quantityLabel} of ${product.sku ?? product.name} from ${sourceBranch.name} to ${destBranch.name}; awaiting receipt confirmation. ${data.notes ?? ''}`,
      },
    })
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/stock')
  revalidatePath('/stock/transfer')
}

export async function confirmStockTransfer(transferId: string) {
  const parsed = z.string().min(1).safeParse(transferId)
  if (!parsed.success) throw new Error('Transfer not found')

  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  const transfer = await db.stockTransfer.findFirst({
    where: {
      id: parsed.data,
      status: 'PENDING',
    },
    select: {
      id: true,
      reference: true,
      productId: true,
      destinationBranchId: true,
      quantity: true,
      quantityUnit: true,
      notes: true,
      Product: { select: { sku: true, name: true } },
      SourceBranch: { select: { name: true } },
      DestinationBranch: { select: { name: true } },
    },
  })
  if (!transfer) throw new Error('Transfer is no longer awaiting receipt')

  const canReceive = ['ADMIN', 'MANAGER'].includes(user.role) || user.branches.some(
    (branch) => branch.id === transfer.destinationBranchId
  )
  if (!canReceive) {
    throw new Error('You can only confirm stock received at your assigned branch')
  }

  if (transfer.quantityUnit !== 'KG' && transfer.quantityUnit !== 'PCS_SETS') {
    throw new Error('Transfer has an unsupported quantity unit')
  }
  const quantityLabel = transfer.quantityUnit === 'KG' ? 'KG' : 'PCS/Sets'

  await withTenantTransaction(user.organizationId, async (tx) => {
    const claimed = await tx.stockTransfer.updateMany({
      where: {
        id: transfer.id,
        status: 'PENDING',
        destinationBranchId: transfer.destinationBranchId,
      },
      data: {
        status: 'RECEIVED',
        receivedAt: new Date(),
        receivedById: user.id,
      },
    })
    if (claimed.count === 0) {
      throw new Error('Transfer has already been received')
    }

    await tx.productBranchStock.upsert({
      where: {
        branchId_productId: {
          branchId: transfer.destinationBranchId,
          productId: transfer.productId,
        },
      },
      update: transfer.quantityUnit === 'KG'
        ? { availableQty: { increment: transfer.quantity } }
        : { availablePiecesSets: { increment: transfer.quantity } },
      create: {
        productId: transfer.productId,
        branchId: transfer.destinationBranchId,
        availableQty: transfer.quantityUnit === 'KG' ? transfer.quantity : 0,
        availablePiecesSets: transfer.quantityUnit === 'PCS_SETS' ? transfer.quantity : 0,
      },
    })

    await tx.stockMovement.create({
      data: {
        productId: transfer.productId,
        branchId: transfer.destinationBranchId,
        movementType: 'transfer_in',
        quantity: transfer.quantity,
        reference: transfer.reference,
        notes: `${quantityLabel} · ${transfer.notes ?? `Received from ${transfer.SourceBranch.name}`}`,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'STOCK_TRANSFER_RECEIVED',
        entityType: 'StockTransfer',
        entityId: transfer.id,
        details: `Received ${transfer.quantity} ${quantityLabel} of ${transfer.Product.sku ?? transfer.Product.name} at ${transfer.DestinationBranch.name} from ${transfer.SourceBranch.name}.`,
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
      AND: [
        {
          OR: [
            { branchId: { in: [branch.id, branch.code, branchCode] } },
            {
              branchStocks: {
                some: {
                  branchId: branch.id,
                  organizationId: user.organizationId,
                },
              },
            },
          ],
        },
        {
          OR: [
            { sku: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    },
    include: {
      branchStocks: {
        where: { branchId: branch.id },
        select: { availableQty: true, availablePiecesSets: true },
      },
    },
    take: 10,
    orderBy: { sku: 'asc' },
  })

  return products.map((p) => ({
    id: p.id,
    product_code: p.sku,
    canonical_name: p.name,
    uom: p.uom,
    stock_at_branch: p.branchStocks[0]?.availableQty ?? (p.branchId === branch.id ? p.currentStock : 0),
    pieces_sets_at_branch: p.branchStocks[0]?.availablePiecesSets ?? (p.branchId === branch.id ? p.piecesSets : 0),
  }))
}
