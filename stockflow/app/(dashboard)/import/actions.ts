'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import type { ResolutionAction } from '@/lib/import/conflict-resolver'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPER
// ─────────────────────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')

  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Only admins and managers can import data')
  }

  return user
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — UPLOAD
// Receives the file, parses it, creates an ImportBatch + ImportRow records
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadImport(formData: FormData) {
  await requireUser()
  throw new Error('Legacy import pipeline is unavailable on the current schema')
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — APPLY MAPPING
// Takes the user-confirmed column → field mapping and parses each row's values
// ─────────────────────────────────────────────────────────────────────────────

export async function applyMapping(batchId: string, formData: FormData) {
  await requireUser()
  throw new Error('Legacy import pipeline is unavailable on the current schema')
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — RESOLVE CONFLICT (single row)
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveImportConflict(
  batchId: string,
  importRowId: string,
  resolution: ResolutionAction
) {
  await requireUser()
  throw new Error('Legacy import conflict resolution is unavailable on the current schema')
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — APPROVE & COMMIT
// Final write of all rows to stock_movements and sales_orders
// ─────────────────────────────────────────────────────────────────────────────

export async function approveAndCommit(batchId: string) {
  await requireUser()
  throw new Error('Legacy import commit flow is unavailable on the current schema')
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL — discard a batch before commit
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelImport(batchId: string) {
  await requireUser()
  throw new Error('Legacy import pipeline is unavailable on the current schema')
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — search products for the conflict resolution mapper
// ─────────────────────────────────────────────────────────────────────────────

export async function searchProductsForMapping(query: string) {
  await requireUser()
  if (!query || query.length < 2) return []
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { code: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 10,
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, category: true },
  })
  return products
}