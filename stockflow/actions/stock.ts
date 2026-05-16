'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import type { BranchCode as Branch } from '@/lib/branches'

async function requireUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')
  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')
  return user
}

async function resolveBranchId(code: string): Promise<string | null> {
  const branch = await prisma.branch.findFirst({
    where: {
      OR: [
        { name: { equals: code, mode: 'insensitive' } },
        { code: { equals: code, mode: 'insensitive' } },
        { name: { contains: code, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  })
  return branch?.id ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK TRANSFER
//
// Note: in this schema stock is tracked on Product.currentStock globally,
// not per-branch. The "transfer" therefore only logs movements and audit
// entries — it doesn't change Product.currentStock because stock doesn't
// belong to a branch in the current data model.
// ─────────────────────────────────────────────────────────────────────────────

const transferSchema = z.object({
  product_id: z.string().min(1),
  source_branch: z.enum(['mombasa', 'nairobi', 'bonje']),
  dest_branch: z.enum(['mombasa', 'nairobi', 'bonje']),
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

  const user = await requireUser()

  const product = await prisma.product.findUnique({
    where: { id: data.product_id },
    select: { id: true, sku: true, name: true, currentStock: true },
  })
  if (!product) throw new Error('Product not found')
  if (product.currentStock < data.qty) {
    throw new Error(
      `Insufficient stock: have ${product.currentStock}, need ${data.qty}`
    )
  }

  const sourceBranchId = await resolveBranchId(data.source_branch)
  const destBranchId = await resolveBranchId(data.dest_branch)
  const reference = `TRANSFER-${Date.now().toString(36).toUpperCase()}`

  await prisma.$transaction(
    async (tx) => {
      // Log the OUT movement
      await tx.stockMovement.create({
        data: {
          productId: data.product_id,
          branchId: sourceBranchId,
          movementType: 'transfer_out',
          quantity: -data.qty,
          reference,
          notes: data.notes ?? `Transfer to ${data.dest_branch}`,
        },
      })

      // Log the IN movement
      await tx.stockMovement.create({
        data: {
          productId: data.product_id,
          branchId: destBranchId,
          movementType: 'transfer_in',
          quantity: data.qty,
          reference,
          notes: data.notes ?? `Transfer from ${data.source_branch}`,
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'STOCK_TRANSFER',
          entityType: 'Product',
          entityId: data.product_id,
          details: `Transferred ${data.qty} ${product.sku ?? product.name} from ${data.source_branch} to ${data.dest_branch}. ${data.notes ?? ''}`,
        },
      })
    },
    { maxWait: 10000, timeout: 30000 }
  )

  revalidatePath('/stock')
  revalidatePath('/stock/transfer')
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH PRODUCTS WITH STOCK
// ─────────────────────────────────────────────────────────────────────────────

export async function searchProductsWithStock(query: string, _branch: Branch) {
  await requireUser()
  if (!query || query.length < 2) return []

  const products = await prisma.product.findMany({
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
