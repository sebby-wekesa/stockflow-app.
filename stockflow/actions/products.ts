'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import { normaliseForMatching } from '@/lib/import/alias-matcher'
import type { ProductCategory } from '@prisma/client'

async function requireUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) throw new Error('Not authenticated')

  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Insufficient permissions')
  }
  return user
}

const createSchema = z.object({
  // form keeps snake_case keys for backwards compat with existing forms
  product_code: z.string().min(1).max(60),
  canonical_name: z.string().min(1).max(200),
  category: z.enum([
    'manufactured_spring',
    'manufactured_ubolt',
    'imported',
    'local_purchase',
    'service',
  ]),
  uom: z.string().min(1).max(20).default('PCS'),
  cost_price: z.coerce.number().nonnegative().optional().nullable(),
  selling_price: z.coerce.number().nonnegative().optional().nullable(),
  reorder_point: z.coerce.number().int().nonnegative().optional().nullable(),
  vendor: z.string().max(200).optional().nullable(),
  // Fields below are not in the schema — accepted but ignored so existing forms don't crash:
  product_type: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  vehicle_make: z.string().max(100).optional().nullable(),
  vehicle_model: z.string().max(100).optional().nullable(),
  spring_position: z.string().max(50).optional().nullable(),
  leaf_position: z.string().max(50).optional().nullable(),
  shaft_size_mm: z.coerce.number().int().positive().optional().nullable(),
  leg_length_inch: z.string().max(20).optional().nullable(),
})

function extractForm(formData: FormData) {
  return {
    product_code: formData.get('product_code'),
    canonical_name: formData.get('canonical_name'),
    category: formData.get('category'),
    uom: formData.get('uom') || 'PCS',
    cost_price: formData.get('cost_price') || null,
    selling_price: formData.get('selling_price') || null,
    reorder_point: formData.get('reorder_point') || null,
    vendor: formData.get('vendor') || null,
    product_type: formData.get('product_type') || null,
    description: formData.get('description') || null,
    vehicle_make: formData.get('vehicle_make') || null,
    vehicle_model: formData.get('vehicle_model') || null,
    spring_position: formData.get('spring_position') || null,
    leaf_position: formData.get('leaf_position') || null,
    shaft_size_mm: formData.get('shaft_size_mm') || null,
    leg_length_inch: formData.get('leg_length_inch') || null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export async function createProduct(formData: FormData) {
  await requireUser()

  const parsed = createSchema.safeParse(extractForm(formData))
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    throw new Error(`${firstError.path.join('.')}: ${firstError.message}`)
  }

  const existing = await prisma.product.findUnique({
    where: { sku: parsed.data.product_code },
  })
  if (existing) {
    throw new Error(`Product code "${parsed.data.product_code}" already exists`)
  }

  const product = await prisma.product.create({
    data: {
      sku: parsed.data.product_code,
      name: parsed.data.canonical_name,
      category: parsed.data.category as ProductCategory,
      uom: parsed.data.uom?.toUpperCase() ?? 'PCS',
      unitCost: parsed.data.cost_price ?? null,
      vendor: parsed.data.vendor ?? null,
      reorderLevel: parsed.data.reorder_point ?? null,
      currentStock: 0,
    },
  })

  // The canonical name itself is automatically a self-alias
  await prisma.productAlias.upsert({
    where: {
      product_id_alias: {
        product_id: product.id,
        alias: parsed.data.canonical_name,
      },
    },
    update: {},
    create: {
      product_id: product.id,
      alias: parsed.data.canonical_name,
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

  const parsed = createSchema.safeParse(extractForm(formData))
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    throw new Error(`${firstError.path.join('.')}: ${firstError.message}`)
  }

  const existing = await prisma.product.findUnique({ where: { id: productId } })
  if (!existing) throw new Error('Product not found')

  if (existing.sku !== parsed.data.product_code) {
    const conflict = await prisma.product.findUnique({
      where: { sku: parsed.data.product_code },
    })
    if (conflict) {
      throw new Error(`Product code "${parsed.data.product_code}" already exists`)
    }
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      sku: parsed.data.product_code,
      name: parsed.data.canonical_name,
      category: parsed.data.category as ProductCategory,
      uom: parsed.data.uom?.toUpperCase() ?? 'PCS',
      unitCost: parsed.data.cost_price ?? null,
      vendor: parsed.data.vendor ?? null,
      reorderLevel: parsed.data.reorder_point ?? null,
    },
  })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — only allowed if no stock movements or sale items exist
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteProduct(productId: string) {
  const user = await requireUser()
  if (user.role !== 'ADMIN') {
    throw new Error('Only admins can delete products')
  }

  const [movementCount, productReceiptCount] = await Promise.all([
    prisma.stockMovement.count({ where: { productId } }),
    prisma.productReceipt.count({ where: { productId } }),
  ])

  if (movementCount + productReceiptCount > 0) {
    throw new Error(
      `Cannot delete: product has ${movementCount} stock movements and ${productReceiptCount} receipts. Remove history first.`
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

  // Check if this alias already maps to a different product
  const existing = await prisma.productAlias.findFirst({
    where: { alias },
  })
  if (existing) {
    if (existing.product_id === productId) {
      throw new Error('This alias already exists for this product')
    }
    const otherProduct = await prisma.product.findUnique({
      where: { id: existing.product_id },
      select: { sku: true, name: true },
    })
    throw new Error(
      `Alias conflict: already mapped to ${otherProduct?.sku} (${otherProduct?.name})`
    )
  }

  await prisma.productAlias.create({
    data: {
      product_id: productId,
      alias,
    },
  })

  revalidatePath(`/products/${productId}`)
}

export async function removeAlias(productId: string, aliasId: string) {
  await requireUser()
  const aliasRow = await prisma.productAlias.findUnique({ where: { id: aliasId } })
  if (!aliasRow) throw new Error('Alias not found')

  // Don't allow removing the canonical alias (one matching the product's name)
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true },
  })
  if (product && aliasRow.alias === product.name) {
    throw new Error(
      'Cannot remove the canonical alias — change the product name instead'
    )
  }

  await prisma.productAlias.delete({ where: { id: aliasId } })
  revalidatePath(`/products/${productId}`)
}
