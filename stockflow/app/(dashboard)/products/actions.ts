'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPER — every action checks the user is logged in and gets their org
// ─────────────────────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    throw new Error('Not authenticated')
  }

  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) {
    throw new Error('User not provisioned')
  }

  // Only admins and managers can modify products
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Insufficient permissions')
  }

  return user
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  product_code: z.string().min(1).max(60),
  canonical_name: z.string().min(1).max(200),
  category: z.string().min(1).max(80),
  uom: z.string().max(40).optional().nullable(),
  selling_price: z.coerce.number().nonnegative().optional().nullable(),
  reorder_point: z.coerce.number().int().nonnegative().optional().nullable(),
})

export async function createProduct(formData: FormData) {
  const user = await requireUser()

  const raw = {
    product_code: formData.get('product_code'),
    canonical_name: formData.get('canonical_name'),
    category: formData.get('category'),
    uom: formData.get('uom'),
    selling_price: formData.get('selling_price') || null,
    reorder_point: formData.get('reorder_point') || null,
  }

  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    throw new Error(`${firstError.path.join('.')}: ${firstError.message}`)
  }

  // Check for duplicate code
  const existing = await prisma.product.findUnique({
    where: { code: parsed.data.product_code },
  })
  if (existing) {
    throw new Error(`Product code "${parsed.data.product_code}" already exists`)
  }

  const product = await prisma.product.create({
    data: {
      code: parsed.data.product_code,
      name: parsed.data.canonical_name,
      category: parsed.data.category,
      uom: parsed.data.uom ?? undefined,
      sellingPrice: parsed.data.selling_price ?? 0,
      reorderPoint: parsed.data.reorder_point ?? 0,
      isService: parsed.data.category.toLowerCase() === 'service',
    },
  })

  revalidatePath('/products')
  redirect(`/products/${product.id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export async function updateProduct(productId: string, formData: FormData) {
  await requireUser()

  const raw = {
    product_code: formData.get('product_code'),
    canonical_name: formData.get('canonical_name'),
    category: formData.get('category'),
    uom: formData.get('uom'),
    selling_price: formData.get('selling_price') || null,
    reorder_point: formData.get('reorder_point') || null,
  }

  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    throw new Error(`${firstError.path.join('.')}: ${firstError.message}`)
  }

  // If code changed, check for conflicts
  const existing = await prisma.product.findUnique({ where: { id: productId } })
  if (!existing) throw new Error('Product not found')

  if (existing.code !== parsed.data.product_code) {
    const conflict = await prisma.product.findUnique({
      where: { code: parsed.data.product_code },
    })
    if (conflict) {
      throw new Error(`Product code "${parsed.data.product_code}" already exists`)
    }
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      code: parsed.data.product_code,
      name: parsed.data.canonical_name,
      category: parsed.data.category,
      uom: parsed.data.uom ?? undefined,
      sellingPrice: parsed.data.selling_price ?? 0,
      reorderPoint: parsed.data.reorder_point ?? 0,
      isService: parsed.data.category.toLowerCase() === 'service',
    },
  })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE ACTIVE / DEACTIVATE
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleProductActive(productId: string) {
  await requireUser()
  const existing = await prisma.product.findUnique({ where: { id: productId } })
  if (!existing) throw new Error('Product not found')

  await prisma.product.update({
    where: { id: productId },
    data: { isActive: !existing.isActive },
  })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — only allowed if no stock movements exist
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteProduct(productId: string) {
  const user = await requireUser()
  if (user.role !== 'ADMIN') {
    throw new Error('Only admins can delete products')
  }

  // Block deletion if there's any history
  const [movementCount, salesCount] = await Promise.all([
    prisma.stockMovement.count({ where: { productId } }),
    prisma.saleOrderLine.count({ where: { productId } }),
  ])

  if (movementCount + salesCount > 0) {
    throw new Error(
      `Cannot delete: product has ${movementCount} stock movements and ${salesCount} sales lines. Deactivate instead.`
    )
  }

  await prisma.product.delete({ where: { id: productId } })

  revalidatePath('/products')
  redirect('/products')
}

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function addAlias(productId: string, formData: FormData) {
  await requireUser()
  throw new Error('Product aliases are not supported by the current schema')
}

export async function removeAlias(productId: string, aliasId: string) {
  await requireUser()
  throw new Error('Product aliases are not supported by the current schema')
}