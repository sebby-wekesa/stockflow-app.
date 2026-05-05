'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Branch } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = createServerSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')

  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')
  return user
}

async function requireBranchAccess(branch: BranchEnum) {
  const user = await requireUser()
  if (user.role !== 'ADMIN' && user.branch?.branch !== branch) {
    throw new Error(`You don't have access to ${branch}`)
  }
  return user
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK ADJUSTMENT — manual correction with mandatory reason
// ─────────────────────────────────────────────────────────────────────────────

const adjustSchema = z.object({
  product_id: z.string().min(1),
  branch: z.enum(['mombasa', 'nairobi', 'bonje']),
  new_qty: z.coerce.number().int().nonnegative(),
  reason: z.string().min(3).max(500),
})

export async function adjustStock(formData: FormData) {
  const raw = {
    product_id: formData.get('product_id'),
    branch: formData.get('branch'),
    new_qty: formData.get('new_qty'),
    reason: formData.get('reason'),
  }

  const parsed = adjustSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { product_id, branch, new_qty, reason } = parsed.data
  const user = await requireBranchAccess(branch)

  // Get current stock
  const current = await prisma.branchStock.findUnique({
    where: { product_id_branch: { product_id, branch } },
  })
  const qty_before = current?.qty ?? 0
  const qty_delta = new_qty - qty_before

  if (qty_delta === 0) {
    throw new Error('New quantity is the same as current — nothing to adjust')
  }

  // Write all of: adjustment record, stock movement (for ledger), and updated balance
  await prisma.$transaction(async (tx) => {
    await tx.stockAdjustment.create({
      data: {
        product_id,
        branch,
        qty_before,
        qty_after: new_qty,
        qty_delta,
        reason,
        created_by: user.id,
      },
    })

    await tx.stockMovement.create({
      data: {
        product_id,
        movement_type: qty_delta > 0 ? 'adjustment_in' : 'adjustment_out',
        branch,
        qty: qty_delta,
        reference: `ADJUST-${Date.now()}`,
        notes: reason,
        movement_date: new Date(),
        created_by: user.id,
      },
    })

    await tx.branchStock.upsert({
      where: { product_id_branch: { product_id, branch } },
      update: { qty: new_qty },
      create: { product_id, branch, qty: new_qty },
    })
  })

  revalidatePath('/stock')
  revalidatePath(`/products/${product_id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// BRANCH TRANSFER — move stock between branches
// Two-step: dispatch creates the out movement, receive creates the in movement
// ─────────────────────────────────────────────────────────────────────────────

const transferSchema = z.object({
  product_id: z.string().min(1),
  source_branch: z.enum(['mombasa', 'nairobi', 'bonje']),
  dest_branch: z.enum(['mombasa', 'nairobi', 'bonje']),
  qty: z.coerce.number().int().positive(),
  notes: z.string().max(500).optional(),
})

export async function dispatchTransfer(formData: FormData) {
  const raw = {
    product_id: formData.get('product_id'),
    source_branch: formData.get('source_branch'),
    dest_branch: formData.get('dest_branch'),
    qty: formData.get('qty'),
    notes: formData.get('notes') || undefined,
  }

  const parsed = transferSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const { product_id, source_branch, dest_branch, qty, notes } = parsed.data
  if (source_branch === dest_branch) {
    throw new Error('Source and destination must be different')
  }

  const user = await requireBranchAccess(source_branch)

  // Verify source has enough stock
  const sourceStock = await prisma.branchStock.findUnique({
    where: { product_id_branch: { product_id, branch: source_branch } },
  })
  if (!sourceStock || sourceStock.qty < qty) {
    throw new Error(
      `Insufficient stock at ${source_branch}: have ${sourceStock?.qty ?? 0}, need ${qty}`
    )
  }

  const transferRef = `TR-${Date.now().toString(36).toUpperCase()}`

  await prisma.$transaction(async (tx) => {
    // OUT movement at source
    await tx.stockMovement.create({
      data: {
        product_id,
        movement_type: 'branch_transfer_out',
        branch: source_branch,
        source_branch,
        dest_branch,
        qty: -qty,
        reference: transferRef,
        notes: notes ?? `Transfer to ${dest_branch}`,
        movement_date: new Date(),
        created_by: user.id,
      },
    })

    // IN movement at destination
    await tx.stockMovement.create({
      data: {
        product_id,
        movement_type: 'branch_transfer_in',
        branch: dest_branch,
        source_branch,
        dest_branch,
        qty,
        reference: transferRef,
        notes: notes ?? `Received from ${source_branch}`,
        movement_date: new Date(),
        created_by: user.id,
      },
    })

    // Decrement source
    await tx.branchStock.update({
      where: { product_id_branch: { product_id, branch: source_branch } },
      data: { qty: { decrement: qty } },
    })

    // Increment destination
    await tx.branchStock.upsert({
      where: { product_id_branch: { product_id, branch: dest_branch } },
      update: { qty: { increment: qty } },
      create: { product_id, branch: dest_branch, qty },
    })
  })

  revalidatePath('/stock')
  revalidatePath(`/products/${product_id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH — used by the transfer modal's product picker
// ─────────────────────────────────────────────────────────────────────────────

export async function searchProductsWithStock(query: string, branch?: Branch) {
  await requireUser()
  if (!query || query.length < 2) return []

  const products = await prisma.product.findMany({
    where: {
      is_active: true,
      category: { not: 'service' }, // services don't carry stock
      OR: [
        { product_code: { contains: query, mode: 'insensitive' } },
        { canonical_name: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 10,
    orderBy: { product_code: 'asc' },
    include: {
      stock_levels: branch ? { where: { branch } } : true,
    },
  })

  return products.map((p) => ({
    id: p.id,
    product_code: p.product_code,
    canonical_name: p.canonical_name,
    uom: p.uom,
    stock_at_branch: branch ? p.stock_levels[0]?.qty ?? 0 : null,
    total_stock: p.stock_levels.reduce((sum, s) => sum + s.qty, 0),
  }))
}
