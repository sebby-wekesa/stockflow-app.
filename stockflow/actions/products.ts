'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveAuth, type AuthUser } from '@/lib/auth'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'
import type { ProductCategory } from '@prisma/client'
import { Prisma } from '@prisma/client'

/** Returns the auth user if role is ADMIN or MANAGER, else throws. */
async function requireProductManager(): Promise<AuthUser> {
  const user = await requireActiveAuth()
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
  const user = await requireProductManager()

  const parsed = createSchema.safeParse(extractForm(formData))
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    throw new Error(`${firstError.path.join('.')}: ${firstError.message}`)
  }

  // Transactional create + alias (sku unique constraint in DB prevents real dups even on race)
  let product: any
  try {
    product = await withTenantTransaction(user.organizationId, async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: parsed.data.product_code,
          name: parsed.data.canonical_name,
          category: parsed.data.category as ProductCategory,
          uom: parsed.data.uom?.toUpperCase() ?? 'PCS',
          unitCost: parsed.data.cost_price ?? null,
          vendor: parsed.data.vendor ?? null,
          reorderLevel: parsed.data.reorder_point ?? null,
          currentStock: 0,
          organizationId: user.organizationId,
        },
      })

      // The canonical name itself is automatically a self-alias
      await tx.productAlias.upsert({
        where: {
          product_id_alias: {
            product_id: created.id,
            alias: parsed.data.canonical_name,
          },
        },
        update: {},
        create: {
          product_id: created.id,
          alias: parsed.data.canonical_name,
          organizationId: user.organizationId,
        },
      })

      return created
    }, { maxWait: 10000, timeout: 30000 })
  } catch (err: any) {
    if (err?.code === 'P2002' || /unique constraint.*sku/i.test(String(err?.message))) {
      throw new Error(`Product code "${parsed.data.product_code}" already exists`)
    }
    throw err
  }

  revalidatePath('/products')
  redirect(`/products/${product.id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export async function updateProduct(productId: string, formData: FormData) {
  const user = await requireProductManager()
  const db = getTenantPrisma(user.organizationId)

  const parsed = createSchema.safeParse(extractForm(formData))
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    throw new Error(`${firstError.path.join('.')}: ${firstError.message}`)
  }

  // findFirst guarantees this product belongs to OUR org (extension adds the filter)
  const existing = await db.product.findFirst({ where: { id: productId } })
  if (!existing) throw new Error('Product not found')

  // If the user is changing the sku, check no other product in this org has it
  if (existing.sku !== parsed.data.product_code) {
    const conflict = await db.product.findFirst({
      where: { sku: parsed.data.product_code, id: { not: productId } },
    })
    if (conflict) {
      throw new Error(`Product code "${parsed.data.product_code}" already exists`)
    }
  }

  await db.product.update({
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
// DELETE — only allowed if no stock movements or receipts exist
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteProduct(productId: string) {
  const user = await requireProductManager()
  if (user.role !== 'ADMIN') {
    throw new Error('Only admins can delete products')
  }
  const db = getTenantPrisma(user.organizationId)

  // Existence + tenant check
  const product = await db.product.findFirst({ where: { id: productId } })
  if (!product) throw new Error('Product not found')

  const [movementCount, receiptCount] = await Promise.all([
    db.stockMovement.count({ where: { productId } }),
    db.productReceipt.count({ where: { productId } }),
  ])

  if (movementCount + receiptCount > 0) {
    throw new Error(
      `Cannot delete: product has ${movementCount} stock movements and ${receiptCount} receipts. Remove history first.`
    )
  }

  await db.productAlias.deleteMany({ where: { product_id: productId } })
  await db.product.delete({ where: { id: productId } })

  revalidatePath('/products')
  redirect('/products')
}

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function addAlias(productId: string, formData: FormData) {
  const user = await requireProductManager()
  const db = getTenantPrisma(user.organizationId)

  const alias = String(formData.get('alias') ?? '').trim()
  if (!alias) throw new Error('Alias cannot be empty')

  // Confirm the product is ours
  const product = await db.product.findFirst({ where: { id: productId } })
  if (!product) throw new Error('Product not found')

  // Check this alias doesn't already exist in our org (across all products)
  const existing = await db.productAlias.findFirst({ where: { alias } })
  if (existing) {
    if (existing.product_id === productId) {
      throw new Error('This alias already exists for this product')
    }
    const otherProduct = await db.product.findFirst({
      where: { id: existing.product_id },
      select: { sku: true, name: true },
    })
    throw new Error(
      `Alias conflict: already mapped to ${otherProduct?.sku} (${otherProduct?.name})`
    )
  }

  await db.productAlias.create({
    data: {
      product_id: productId,
      alias,
      organizationId: user.organizationId,
    },
  })

  revalidatePath(`/products/${productId}`)
}

export async function removeAlias(productId: string, aliasId: string) {
  const user = await requireProductManager()
  const db = getTenantPrisma(user.organizationId)

  const aliasRow = await db.productAlias.findFirst({ where: { id: aliasId } })
  if (!aliasRow) throw new Error('Alias not found')
  if (aliasRow.product_id !== productId) {
    throw new Error('Alias does not belong to this product')
  }

  const product = await db.product.findFirst({
    where: { id: productId },
    select: { name: true },
  })
  if (product && aliasRow.alias === product.name) {
    throw new Error(
      'Cannot remove the canonical alias — change the product name instead'
    )
  }

  await db.productAlias.delete({ where: { id: aliasId } })
  revalidatePath(`/products/${productId}`)
}
