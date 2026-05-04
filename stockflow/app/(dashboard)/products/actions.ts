'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import { normaliseForMatching } from '@/lib/import/alias-matcher'
import type { ProductCategory, ProductType, UOM } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPER — every action checks the user is logged in and gets their org
// ─────────────────────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = createServerSupabase()
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
  if (user.role !== 'admin' && user.role !== 'manager') {
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
  category: z.enum([
    'manufactured_spring',
    'manufactured_ubolt',
    'imported',
    'local_purchase',
    'service',
  ]),
  product_type: z.string().min(1),
  uom: z.enum(['pcs', 'set', 'kg', 'litres', 'metres', 'box']),
  description: z.string().max(500).optional().nullable(),
  vehicle_make: z.string().max(100).optional().nullable(),
  vehicle_model: z.string().max(100).optional().nullable(),
  spring_position: z.string().max(50).optional().nullable(),
  leaf_position: z.string().max(50).optional().nullable(),
  shaft_size_mm: z.coerce.number().int().positive().optional().nullable(),
  leg_length_inch: z.string().max(20).optional().nullable(),
  cost_price: z.coerce.number().nonnegative().optional().nullable(),
  selling_price: z.coerce.number().nonnegative().optional().nullable(),
  reorder_point: z.coerce.number().int().nonnegative().optional().nullable(),
})

export async function createProduct(formData: FormData) {
  const user = await requireUser()

  const raw = {
    product_code: formData.get('product_code'),
    canonical_name: formData.get('canonical_name'),
    category: formData.get('category'),
    product_type: formData.get('product_type'),
    uom: formData.get('uom'),
    description: formData.get('description') || null,
    vehicle_make: formData.get('vehicle_make') || null,
    vehicle_model: formData.get('vehicle_model') || null,
    spring_position: formData.get('spring_position') || null,
    leaf_position: formData.get('leaf_position') || null,
    shaft_size_mm: formData.get('shaft_size_mm') || null,
    leg_length_inch: formData.get('leg_length_inch') || null,
    cost_price: formData.get('cost_price') || null,
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
    where: { product_code: parsed.data.product_code },
  })
  if (existing) {
    throw new Error(`Product code "${parsed.data.product_code}" already exists`)
  }

  const product = await prisma.product.create({
    data: {
      org_id: user.org_id,
      product_code: parsed.data.product_code,
      canonical_name: parsed.data.canonical_name,
      category: parsed.data.category,
      product_type: parsed.data.product_type as ProductType,
      uom: parsed.data.uom as UOM,
      description: parsed.data.description,
      vehicle_make: parsed.data.vehicle_make,
      vehicle_model: parsed.data.vehicle_model,
      spring_position: parsed.data.spring_position,
      leaf_position: parsed.data.leaf_position,
      shaft_size_mm: parsed.data.shaft_size_mm,
      leg_length_inch: parsed.data.leg_length_inch,
      cost_price: parsed.data.cost_price,
      selling_price: parsed.data.selling_price,
      reorder_point: parsed.data.reorder_point,
    },
  })

  // The canonical name itself is automatically a self-alias
  await prisma.productAlias.create({
    data: {
      product_id: product.id,
      alias: parsed.data.canonical_name,
      alias_clean: normaliseForMatching(parsed.data.canonical_name),
      source: 'canonical',
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
    product_type: formData.get('product_type'),
    uom: formData.get('uom'),
    description: formData.get('description') || null,
    vehicle_make: formData.get('vehicle_make') || null,
    vehicle_model: formData.get('vehicle_model') || null,
    spring_position: formData.get('spring_position') || null,
    leaf_position: formData.get('leaf_position') || null,
    shaft_size_mm: formData.get('shaft_size_mm') || null,
    leg_length_inch: formData.get('leg_length_inch') || null,
    cost_price: formData.get('cost_price') || null,
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

  if (existing.product_code !== parsed.data.product_code) {
    const conflict = await prisma.product.findUnique({
      where: { product_code: parsed.data.product_code },
    })
    if (conflict) {
      throw new Error(`Product code "${parsed.data.product_code}" already exists`)
    }
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      product_code: parsed.data.product_code,
      canonical_name: parsed.data.canonical_name,
      category: parsed.data.category,
      product_type: parsed.data.product_type as ProductType,
      uom: parsed.data.uom as UOM,
      description: parsed.data.description,
      vehicle_make: parsed.data.vehicle_make,
      vehicle_model: parsed.data.vehicle_model,
      spring_position: parsed.data.spring_position,
      leaf_position: parsed.data.leaf_position,
      shaft_size_mm: parsed.data.shaft_size_mm,
      leg_length_inch: parsed.data.leg_length_inch,
      cost_price: parsed.data.cost_price,
      selling_price: parsed.data.selling_price,
      reorder_point: parsed.data.reorder_point,
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
    data: { is_active: !existing.is_active },
  })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — only allowed if no stock movements exist
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteProduct(productId: string) {
  const user = await requireUser()
  if (user.role !== 'admin') {
    throw new Error('Only admins can delete products')
  }

  // Block deletion if there's any history
  const [movementCount, salesCount, jobCardCount] = await Promise.all([
    prisma.stockMovement.count({ where: { product_id: productId } }),
    prisma.salesOrderLine.count({ where: { product_id: productId } }),
    prisma.jobCard.count({ where: { product_id: productId } }),
  ])

  if (movementCount + salesCount + jobCardCount > 0) {
    throw new Error(
      `Cannot delete: product has ${movementCount} stock movements, ${salesCount} sales lines, and ${jobCardCount} job cards. Deactivate instead.`
    )
  }

  await prisma.productAlias.deleteMany({ where: { product_id: productId } })
  await prisma.product.delete({ where: { id: productId } })

  revalidatePath('/products')
  redirect('/products')
}

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function addAlias(productId: string, formData: FormData) {
  await requireUser()
  const alias = String(formData.get('alias') ?? '').trim()
  if (!alias) throw new Error('Alias cannot be empty')

  const alias_clean = normaliseForMatching(alias)

  // Check if this alias already maps to a different product
  const existing = await prisma.productAlias.findUnique({ where: { alias_clean } })
  if (existing) {
    if (existing.product_id === productId) {
      throw new Error('This alias already exists for this product')
    }
    const otherProduct = await prisma.product.findUnique({
      where: { id: existing.product_id },
      select: { product_code: true, canonical_name: true },
    })
    throw new Error(
      `Alias conflict: already mapped to ${otherProduct?.product_code} (${otherProduct?.canonical_name})`
    )
  }

  await prisma.productAlias.create({
    data: { product_id: productId, alias, alias_clean, source: 'manual' },
  })

  revalidatePath(`/products/${productId}`)
}

export async function removeAlias(productId: string, aliasId: string) {
  await requireUser()
  const alias = await prisma.productAlias.findUnique({ where: { id: aliasId } })
  if (!alias) throw new Error('Alias not found')
  if (alias.source === 'canonical') {
    throw new Error('Cannot remove the canonical alias — change the canonical name instead')
  }
  await prisma.productAlias.delete({ where: { id: aliasId } })
  revalidatePath(`/products/${productId}`)
}