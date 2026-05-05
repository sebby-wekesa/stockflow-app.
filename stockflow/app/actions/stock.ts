'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import type { BranchEnum } from '@prisma/client'

// AUTH
async function requireUser() {
  const supabase = await createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()
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

// STOCK ADJUSTMENT
const adjustSchema = z.object({
  productId: z.string().min(1),
  branch: z.enum(['mombasa', 'nairobi', 'bonje']),
  newQty: z.coerce.number().int().nonnegative(),
  reason: z.string().min(3).max(500),
})

export async function adjustStock(formData: FormData) {
  const raw = {
    productId: formData.get('productId'),
    branch: formData.get('branch'),
    newQty: formData.get('newQty'),
    reason: formData.get('reason'),
  }

  const parsed = adjustSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const { productId, branch, newQty, reason } = parsed.data
  const user = await requireBranchAccess(branch)

  const current = await prisma.branchStock.findUnique({
    where: { productId_branch: { productId, branch } },
  })
  const qtyBefore = current?.qty ?? 0
  const qtyDelta = newQty - qtyBefore

  if (qtyDelta === 0) throw new Error('New quantity is the same as current — nothing to adjust')

  await prisma.$transaction(async (tx) => {
    await tx.stockAdjustment.create({
      data: {
        productId,
        branch,
        oldQty: qtyBefore,
        newQty,
        delta: qtyDelta,
        reason,
        userId: user.id,
      },
    })

    await tx.stockMovement.create({
      data: {
        productId,
        type: qtyDelta > 0 ? 'adjustment_in' : 'adjustment_out',
        branch,
        qty: qtyDelta,
        reference: `ADJUST-${Date.now()}`,
        notes: reason,
        userId: user.id,
      },
    })

    await tx.branchStock.upsert({
      where: { productId_branch: { productId, branch } },
      update: { qty: newQty },
      create: { productId, branch, qty: newQty },
    })
  })

  revalidatePath('/stock')
  revalidatePath(`/products/${productId}`)
}

// BRANCH TRANSFER
const transferSchema = z.object({
  productId: z.string().min(1),
  sourceBranch: z.enum(['mombasa', 'nairobi', 'bonje']),
  destBranch: z.enum(['mombasa', 'nairobi', 'bonje']),
  qty: z.coerce.number().int().positive(),
  notes: z.string().max(500).optional(),
})

export async function dispatchTransfer(formData: FormData) {
  const raw = {
    productId: formData.get('productId'),
    sourceBranch: formData.get('sourceBranch'),
    destBranch: formData.get('destBranch'),
    qty: formData.get('qty'),
    notes: formData.get('notes') || undefined,
  }

  const parsed = transferSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const { productId, sourceBranch, destBranch, qty, notes } = parsed.data
  if (sourceBranch === destBranch) throw new Error('Source and destination must be different')

  const user = await requireBranchAccess(sourceBranch)

  const sourceStock = await prisma.branchStock.findUnique({
    where: { productId_branch: { productId, branch: sourceBranch } },
  })
  if (!sourceStock || sourceStock.qty < qty) {
    throw new Error(`Insufficient stock at ${sourceBranch}: have ${sourceStock?.qty ?? 0}, need ${qty}`)
  }

  const transferRef = `TR-${Date.now().toString(36).toUpperCase()}`

  await prisma.$transaction(async (tx) => {
    await tx.stockMovement.create({
      data: {
        productId,
        type: 'branch_transfer_out',
        branch: sourceBranch,
        qty: -qty,
        reference: transferRef,
        notes: notes ?? `Transfer to ${destBranch}`,
        userId: user.id,
        sourceBranch,
        destBranch,
      },
    })

    await tx.stockMovement.create({
      data: {
        productId,
        type: 'branch_transfer_in',
        branch: destBranch,
        qty,
        reference: transferRef,
        notes: notes ?? `Received from ${sourceBranch}`,
        userId: user.id,
        sourceBranch,
        destBranch,
      },
    })

    await tx.branchStock.update({
      where: { productId_branch: { productId, branch: sourceBranch } },
      data: { qty: { decrement: qty } },
    })

    await tx.branchStock.upsert({
      where: { productId_branch: { productId, branch: destBranch } },
      update: { qty: { increment: qty } },
      create: { productId, branch: destBranch, qty },
    })
  })

  revalidatePath('/stock')
  revalidatePath(`/products/${productId}`)
}

// SEARCH
export async function searchProductsWithStock(query: string, branch?: BranchEnum) {
  await requireUser()
  if (!query || query.length < 2) return []

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      isService: false,
      OR: [
        { code: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 10,
    orderBy: { code: 'asc' },
    include: {
      branchStocks: branch ? { where: { branch } } : true,
    },
  })

  return products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    uom: p.uom,
    stockAtBranch: branch ? p.branchStocks[0]?.qty ?? 0 : null,
    totalStock: p.branchStocks.reduce((sum, s) => sum + s.qty, 0),
  }))
}