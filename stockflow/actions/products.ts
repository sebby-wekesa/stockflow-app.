'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveAuth, type AuthUser } from '@/lib/auth'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'
import type { ProductCategory, StockOrigin } from '@prisma/client'
import { PRODUCT_CATEGORIES, normalizeProductUom } from '@/lib/products'
import { ALL_BRANCHES, normalizeBranchCode, type BranchCode } from '@/lib/branches'
import { syncProductShadowStock } from '@/lib/order-lifecycle'

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
  category: z.enum(PRODUCT_CATEGORIES),
  origin: z.enum(['FACTORY_MADE', 'LOCAL_PURCHASE', 'IMPORTED']).default('FACTORY_MADE'),
  uom: z.preprocess(
    (value) => normalizeProductUom(value),
    z.enum(['KG'], {
      invalid_type_error: 'UOM must be KG',
      required_error: 'UOM must be KG',
    })
  ),
  cost_price: z.coerce.number().nonnegative().optional().nullable(),
  selling_price: z.coerce.number().nonnegative().optional().nullable(),
  reorder_point: z.coerce.number().int().nonnegative().optional().nullable(),
  pieces_sets: z.coerce.number().int().nonnegative().optional().default(0),
  branch: z.enum(ALL_BRANCHES as [BranchCode, ...BranchCode[]]),
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

const updateSchema = createSchema.extend({
  current_stock: z.coerce.number().nonnegative().optional().nullable(),
  adjustment_reason: z.string().max(500).optional().nullable(),
})

const updateCategorySchema = z.object({
  category: z.enum(PRODUCT_CATEGORIES),
})

const updateOriginSchema = z.object({
  origin: z.enum(['FACTORY_MADE', 'LOCAL_PURCHASE', 'IMPORTED']),
})

const updateUomSchema = z.object({
  uom: z.preprocess(
    (value) => normalizeProductUom(value),
    z.enum(['KG'], {
      invalid_type_error: 'UOM must be KG',
      required_error: 'UOM must be KG',
    })
  ),
})

const updatePiecesSetsSchema = z.object({
  piecesSets: z.coerce.number().int().nonnegative(),
})

const updateCurrentStockSchema = z.object({
  currentStock: z.coerce.number().nonnegative(),
})

function extractForm(formData: FormData) {
  return {
    product_code: formData.get('product_code'),
    canonical_name: formData.get('canonical_name'),
    category: formData.get('category'),
    origin: formData.get('origin') || 'FACTORY_MADE',
    uom: formData.get('uom') || 'KG',
    cost_price: formData.get('cost_price') || null,
    selling_price: formData.get('selling_price') || null,
    reorder_point: formData.get('reorder_point') || null,
    pieces_sets: formData.get('pieces_sets') || 0,
    branch: formData.get('branch'),
    vendor: formData.get('vendor') || null,
    product_type: formData.get('product_type') || null,
    description: formData.get('description') || null,
    vehicle_make: formData.get('vehicle_make') || null,
    vehicle_model: formData.get('vehicle_model') || null,
    spring_position: formData.get('spring_position') || null,
    leaf_position: formData.get('leaf_position') || null,
    shaft_size_mm: formData.get('shaft_size_mm') || null,
    leg_length_inch: formData.get('leg_length_inch') || null,
    current_stock: formData.get('current_stock') || null,
    adjustment_reason: formData.get('adjustment_reason') || null,
  }
}

async function resolveProductBranch(
  db: ReturnType<typeof getTenantPrisma>,
  branchCode: BranchCode
) {
  const branches = await db.branch.findMany({
    select: { id: true, name: true, code: true, location: true },
  })
  const branch = branches.find(
    (candidate) =>
      normalizeBranchCode(candidate.code, candidate.name, candidate.location) === branchCode
  )

  if (!branch) {
    throw new Error(`The ${branchCode} branch has not been configured for this organization`)
  }

  return branch
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export async function createProduct(formData: FormData) {
  const user = await requireProductManager()
  const db = getTenantPrisma(user.organizationId)

  const parsed = createSchema.safeParse(extractForm(formData))
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    throw new Error(`${firstError.path.join('.')}: ${firstError.message}`)
  }
  const branch = await resolveProductBranch(db, parsed.data.branch)

  // Transactional create + alias (sku unique constraint in DB prevents real dups even on race)
  let product: any
  try {
    product = await withTenantTransaction(user.organizationId, async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: parsed.data.product_code,
          name: parsed.data.canonical_name,
          category: parsed.data.category as ProductCategory,
          origin: parsed.data.origin as StockOrigin,
          uom: parsed.data.uom,
          unitCost: parsed.data.cost_price ?? null,
          vendor: parsed.data.vendor ?? null,
          reorderLevel: parsed.data.reorder_point ?? null,
          piecesSets: parsed.data.pieces_sets ?? 0,
          currentStock: 0,
          branchId: branch.id,
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

  const parsed = updateSchema.safeParse(extractForm(formData))
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    throw new Error(`${firstError.path.join('.')}: ${firstError.message}`)
  }
  const branch = await resolveProductBranch(db, parsed.data.branch)

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

  const nextStock = parsed.data.current_stock
  const stockChanged = nextStock != null && nextStock !== existing.currentStock
  const stockDelta = stockChanged ? nextStock - existing.currentStock : 0

  await withTenantTransaction(user.organizationId, async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        sku: parsed.data.product_code,
        name: parsed.data.canonical_name,
        category: parsed.data.category as ProductCategory,
        origin: parsed.data.origin as StockOrigin,
        uom: parsed.data.uom,
        unitCost: parsed.data.cost_price ?? null,
        vendor: parsed.data.vendor ?? null,
        reorderLevel: parsed.data.reorder_point ?? null,
        piecesSets: parsed.data.pieces_sets ?? 0,
        branchId: branch.id,
        ...(stockChanged ? { currentStock: nextStock } : {}),
      },
    })

    if (stockChanged) {
      await syncProductShadowStock(
        tx,
        existing.sku,
        parsed.data.product_code,
        nextStock
      )
      await tx.stockMovement.create({
        data: {
          productId,
          movementType: 'adjustment',
          quantity: stockDelta,
          reference: `PRODUCT-EDIT-${Date.now().toString(36).toUpperCase()}`,
          notes: parsed.data.adjustment_reason?.trim() ?? 'Product edit stock adjustment',
        },
      })
    }
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

export async function updateProductCategory(productId: string, category: ProductCategory) {
  const user = await requireProductManager()
  const db = getTenantPrisma(user.organizationId)

  const parsed = updateCategorySchema.safeParse({ category })
  if (!parsed.success) {
    throw new Error('Invalid product category')
  }

  const product = await db.product.findFirst({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) throw new Error('Product not found')

  await db.product.update({
    where: { id: productId },
    data: { category: parsed.data.category as ProductCategory },
  })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

export async function updateProductOrigin(productId: string, origin: StockOrigin) {
  const user = await requireProductManager()
  const db = getTenantPrisma(user.organizationId)

  const parsed = updateOriginSchema.safeParse({ origin })
  if (!parsed.success) {
    throw new Error('Invalid product origin')
  }

  const product = await db.product.findFirst({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) throw new Error('Product not found')

  await db.product.update({
    where: { id: productId },
    data: { origin: parsed.data.origin as StockOrigin },
  })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

export async function updateProductBranch(productId: string, branchCode: BranchCode) {
  const user = await requireProductManager()
  const db = getTenantPrisma(user.organizationId)

  if (!ALL_BRANCHES.includes(branchCode)) {
    throw new Error('Invalid branch')
  }

  const [product, branch] = await Promise.all([
    db.product.findFirst({
      where: { id: productId },
      select: { id: true },
    }),
    resolveProductBranch(db, branchCode),
  ])
  if (!product) throw new Error('Product not found')

  await db.product.update({
    where: { id: productId },
    data: { branchId: branch.id },
  })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

export async function updateProductUom(productId: string, uom: string) {
  const user = await requireProductManager()
  const db = getTenantPrisma(user.organizationId)

  const parsed = updateUomSchema.safeParse({ uom })
  if (!parsed.success) {
    throw new Error('UOM must be KG')
  }

  const product = await db.product.findFirst({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) throw new Error('Product not found')

  await db.product.update({
    where: { id: productId },
    data: { uom: parsed.data.uom },
  })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

export async function updateProductPiecesSets(productId: string, piecesSets: number) {
  const user = await requireProductManager()
  const db = getTenantPrisma(user.organizationId)

  const parsed = updatePiecesSetsSchema.safeParse({ piecesSets })
  if (!parsed.success) {
    throw new Error('PCS/Sets must be a whole number')
  }

  const product = await db.product.findFirst({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) throw new Error('Product not found')

  await db.product.update({
    where: { id: productId },
    data: { piecesSets: parsed.data.piecesSets },
  })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

export async function updateProductCurrentStock(productId: string, currentStock: number) {
  const user = await requireProductManager()
  const db = getTenantPrisma(user.organizationId)

  const parsed = updateCurrentStockSchema.safeParse({ currentStock })
  if (!parsed.success) {
    throw new Error('Current stock must be zero or greater')
  }

  const product = await db.product.findFirst({
    where: { id: productId },
    select: { id: true, sku: true, currentStock: true },
  })
  if (!product) throw new Error('Product not found')

  const nextStock = parsed.data.currentStock
  const stockDelta = nextStock - product.currentStock
  if (stockDelta === 0) return

  await withTenantTransaction(user.organizationId, async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { currentStock: nextStock },
    })

    await syncProductShadowStock(tx, product.sku, product.sku, nextStock)

    await tx.stockMovement.create({
      data: {
        productId,
        movementType: 'adjustment',
        quantity: stockDelta,
        reference: `PRODUCT-STOCK-${Date.now().toString(36).toUpperCase()}`,
        notes: 'Inline product stock adjustment',
      },
    })
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/products')
  revalidatePath(`/products/${productId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — allowed if no receipts exist. Movement history is removed with the product.
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteProduct(productId: string) {
  const user = await requireProductManager()
  if (user.role !== 'ADMIN') {
    throw new Error('Only admins can delete products')
  }
  await withTenantTransaction(user.organizationId, async (tx) => {
    // Existence + tenant check
    const product = await tx.product.findFirst({ where: { id: productId } })
    if (!product) throw new Error('Product not found')

    const receiptCount = await tx.productReceipt.count({ where: { productId } })
    if (receiptCount > 0) {
      throw new Error(
        `Cannot delete: product has ${receiptCount} receipts. Remove receipts first.`
      )
    }

    await tx.stockMovement.deleteMany({ where: { productId } })
    await tx.productAlias.deleteMany({ where: { product_id: productId } })
    await tx.product.delete({ where: { id: productId } })
  }, { maxWait: 10000, timeout: 30000 })

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
