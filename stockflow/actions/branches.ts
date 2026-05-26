'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveAuth, type AuthUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — only org admins/managers can manage branches
// ─────────────────────────────────────────────────────────────────────────────

async function requireBranchManager(): Promise<AuthUser> {
  const user = await requireActiveAuth()
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Only admins and managers can manage branches')
  }
  return user
}

// Branch code: short identifier used in invoice prefixes, stock movement
// references, etc. Keep it short and alpha-numeric.
const codeSchema = z
  .string()
  .trim()
  .min(2, 'Branch code must be at least 2 characters')
  .max(10, 'Branch code must be at most 10 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'Branch code may only contain letters, numbers, hyphens, and underscores')

const branchSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  code: codeSchema,
  location: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
})

function readBranchForm(formData: FormData) {
  return {
    name: formData.get('name'),
    code: formData.get('code'),
    location: formData.get('location') || null,
    address: formData.get('address') || null,
    phone: formData.get('phone') || null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export async function createBranch(formData: FormData) {
  const user = await requireBranchManager()
  const db = getTenantPrisma(user.organizationId)

  const parsed = branchSchema.safeParse(readBranchForm(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Uniqueness is enforced at the DB level via @@unique([organizationId, name])
  // and @@unique([organizationId, code]) — but we check here first to give a
  // friendlier error message than P2002.
  const [nameConflict, codeConflict] = await Promise.all([
    db.branch.findFirst({ where: { name: { equals: parsed.data.name, mode: 'insensitive' } } }),
    db.branch.findFirst({ where: { code: { equals: parsed.data.code, mode: 'insensitive' } } }),
  ])

  if (nameConflict) {
    return { error: `A branch named "${parsed.data.name}" already exists` }
  }
  if (codeConflict) {
    return { error: `A branch with code "${parsed.data.code}" already exists` }
  }

  try {
    await db.branch.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code.toLowerCase(),
        location: parsed.data.location ?? null,
        address: parsed.data.address ?? null,
        phone: parsed.data.phone ?? null,
        organizationId: user.organizationId,
      },
    })
  } catch (err) {
    // Race-condition fallback: if a concurrent create wins the unique
    // constraint, surface a clean error rather than the P2002 stack trace.
    console.error('createBranch failed:', err)
    return { error: 'Could not create branch — please try again' }
  }

  revalidatePath('/settings/branches')
  revalidatePath('/onboarding')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export async function updateBranch(branchId: string, formData: FormData) {
  const user = await requireBranchManager()
  const db = getTenantPrisma(user.organizationId)

  if (!branchId || typeof branchId !== 'string') {
    return { error: 'Invalid branch id' }
  }

  const parsed = branchSchema.safeParse(readBranchForm(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Verify the branch belongs to this org (tenant prisma scopes the lookup)
  const existing = await db.branch.findFirst({ where: { id: branchId } })
  if (!existing) {
    return { error: 'Branch not found' }
  }

  // Check uniqueness only if name/code changed
  if (existing.name.toLowerCase() !== parsed.data.name.toLowerCase()) {
    const conflict = await db.branch.findFirst({
      where: {
        name: { equals: parsed.data.name, mode: 'insensitive' },
        id: { not: branchId },
      },
    })
    if (conflict) {
      return { error: `A branch named "${parsed.data.name}" already exists` }
    }
  }
  if (existing.code.toLowerCase() !== parsed.data.code.toLowerCase()) {
    const conflict = await db.branch.findFirst({
      where: {
        code: { equals: parsed.data.code, mode: 'insensitive' },
        id: { not: branchId },
      },
    })
    if (conflict) {
      return { error: `A branch with code "${parsed.data.code}" already exists` }
    }
  }

  try {
    await db.branch.update({
      where: { id: branchId },
      data: {
        name: parsed.data.name,
        code: parsed.data.code.toLowerCase(),
        location: parsed.data.location ?? null,
        address: parsed.data.address ?? null,
        phone: parsed.data.phone ?? null,
      },
    })
  } catch (err) {
    console.error('updateBranch failed:', err)
    return { error: 'Could not update branch — please try again' }
  }

  revalidatePath('/settings/branches')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
//
// Only allowed if the branch has no movements, products, users, or other
// references. Removing a branch with history would orphan those records.
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteBranch(branchId: string) {
  const user = await requireBranchManager()
  if (user.role !== 'ADMIN') {
    return { error: 'Only admins can delete branches' }
  }
  const db = getTenantPrisma(user.organizationId)

  const branch = await db.branch.findFirst({ where: { id: branchId } })
  if (!branch) {
    return { error: 'Branch not found' }
  }

  // Check for dependent records in parallel
  const [
    userCount,
    productCount,
    movementCount,
    receiptCount,
    materialReceiptCount,
    invFGCount,
    invRMCount,
  ] = await Promise.all([
    db.user.count({ where: { branchId } }),
    db.product.count({ where: { branchId } }),
    db.stockMovement.count({ where: { branchId } }),
    db.productReceipt.count({ where: { branchId } }),
    db.materialReceipt.count({ where: { branchId } }),
    db.inventoryFinishedGoods.count({ where: { branchId } }),
    db.inventoryRawMaterial.count({ where: { branchId } }),
  ])

  const total = userCount + productCount + movementCount + receiptCount + materialReceiptCount + invFGCount + invRMCount
  if (total > 0) {
    const parts: string[] = []
    if (userCount) parts.push(`${userCount} user${userCount === 1 ? '' : 's'}`)
    if (productCount) parts.push(`${productCount} product${productCount === 1 ? '' : 's'}`)
    if (movementCount) parts.push(`${movementCount} stock movement${movementCount === 1 ? '' : 's'}`)
    if (receiptCount + materialReceiptCount) parts.push(`${receiptCount + materialReceiptCount} receipt${(receiptCount + materialReceiptCount) === 1 ? '' : 's'}`)
    if (invFGCount + invRMCount) parts.push(`${invFGCount + invRMCount} inventory record${(invFGCount + invRMCount) === 1 ? '' : 's'}`)
    return {
      error: `Cannot delete "${branch.name}": ${parts.join(', ')} reference this branch. Reassign or remove them first.`,
    }
  }

  try {
    await db.branch.delete({ where: { id: branchId } })
  } catch (err) {
    console.error('deleteBranch failed:', err)
    return { error: 'Could not delete branch — please try again' }
  }

  revalidatePath('/settings/branches')
  return { success: true }
}
