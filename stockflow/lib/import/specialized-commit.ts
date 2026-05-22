/**
 * Specialized commit layer — writes parsed Excel rows to the actual schema.
 * Tenant-aware: all commit functions accept an organizationId and scope
 * every DB call to that tenant.
 */

import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'
import { matchProductName, clearAliasCache } from './alias-matcher'
import type {
  ParsedSalesRow,
  ParsedProductRow,
  ParsedStockRow,
} from './specialized-parsers'

export type CommitResult = {
  total: number
  written: number
  skipped: number
  errors: Array<{ row: number; error: string }>
  unmatchedNames?: Array<{ raw_name: string; rows: number[]; total_qty: number }>
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Branch cache is keyed by (orgId, branchCode) so different orgs don't collide
const branchCache = new Map<string, string | null>()
function branchCacheKey(orgId: string, code: string) {
  return `${orgId}:${code.toLowerCase().trim()}`
}

async function resolveBranchId(
  orgId: string,
  code: string | null | undefined
): Promise<string | null> {
  if (!code) return null
  const key = branchCacheKey(orgId, code)
  if (branchCache.has(key)) return branchCache.get(key)!

  const db = getTenantPrisma(orgId)
  const normalized = code.toLowerCase().trim()
  const branch = await db.branch.findFirst({
    where: {
      OR: [
        { name: { equals: normalized, mode: 'insensitive' } },
        { code: { equals: normalized, mode: 'insensitive' } },
        { name: { contains: normalized, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  })

  const result = branch?.id ?? null
  branchCache.set(key, result)
  return result
}

export function clearBranchCache() {
  branchCache.clear()
}

function mapCategory(
  cat: string
): 'manufactured_spring' | 'manufactured_ubolt' | 'imported' | 'local_purchase' | 'service' {
  if (cat === 'manufactured_spring') return 'manufactured_spring'
  if (cat === 'manufactured_ubolt') return 'manufactured_ubolt'
  if (cat === 'imported') return 'imported'
  if (cat === 'local_purchase') return 'local_purchase'
  return 'local_purchase'
}

function generateSku(productCode: string | null, name: string): string {
  if (productCode) return productCode
  return name.slice(0, 40).toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-')
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT MASTER COMMIT
// ─────────────────────────────────────────────────────────────────────────────

export async function commitProductMaster(
  rows: ParsedProductRow[],
  importBatchId: string,
  userId: string,
  organizationId: string
): Promise<CommitResult> {
  const result: CommitResult = { total: rows.length, written: 0, skipped: 0, errors: [] }

  const CHUNK = 50
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)

    await withTenantTransaction(organizationId, async (tx) => {
      for (const row of chunk) {
        try {
          const sku = generateSku(row.product_code, row.canonical_name)
          if (!sku) {
            result.skipped++
            continue
          }

          // Tenant-scoped lookup — only finds products in OUR org
          const existing = await tx.product.findFirst({ where: { sku } })

          let product
          if (existing) {
            product = await tx.product.update({
              where: { id: existing.id },
              data: {
                name: row.canonical_name,
                category: mapCategory(row.category),
                uom: row.uom?.toUpperCase() ?? 'PCS',
                ...(row.cost_price !== null && { unitCost: row.cost_price }),
              },
            })
          } else {
            product = await tx.product.create({
              data: {
                name: row.canonical_name,
                sku,
                category: mapCategory(row.category),
                origin: 'FACTORY_MADE',
                uom: row.uom?.toUpperCase() ?? 'PCS',
                currentStock: 0,
                unitCost: row.cost_price ?? null,
              },
            })
          }

          await tx.productAlias.upsert({
            where: {
              product_id_alias: {
                product_id: product.id,
                alias: row.canonical_name,
              },
            },
            update: {},
            create: {
              product_id: product.id,
              alias: row.canonical_name,
            },
          })

          result.written++
        } catch (err) {
          result.errors.push({
            row: row.source_row,
            error: (err as Error).message,
          })
        }
      }
    }, { maxWait: 10000, timeout: 30000 })
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// SALES COMMIT
// ─────────────────────────────────────────────────────────────────────────────

export async function commitSalesImport(
  rows: ParsedSalesRow[],
  importBatchId: string,
  userId: string,
  organizationId: string
): Promise<CommitResult> {
  const result: CommitResult = {
    total: rows.length,
    written: 0,
    skipped: 0,
    errors: [],
    unmatchedNames: [],
  }

  const db = getTenantPrisma(organizationId)

  // Match every raw_product_name once, tenant-scoped
  const uniqueNames = new Set<string>()
  for (const r of rows) {
    if (r.raw_product_name) uniqueNames.add(r.raw_product_name)
  }

  const nameToProductId = new Map<string, string>()
  const unmatched = new Map<string, { rows: number[]; total_qty: number }>()

  for (const name of uniqueNames) {
    const match = await matchProductName(name, organizationId)
    if (match?.product?.id) {
      nameToProductId.set(name, match.product.id)
    } else {
      unmatched.set(name, { rows: [], total_qty: 0 })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTO-CREATE MISSING PRODUCTS (for sales imports)
  // If a product name from the sales file does not exist, create it as
  // local_purchase so the sale can still be recorded and stock reduced.
  // ─────────────────────────────────────────────────────────────────────────────
  for (const name of Array.from(unmatched.keys())) {
    try {
      const sku = generateSku(null, name)
      const newProduct = await db.product.create({
        data: {
          name: name.trim(),
          sku,
          category: 'local_purchase',
          origin: 'LOCAL_PURCHASE',
          uom: 'pcs',
          currentStock: 0,
          organizationId,
        },
      })

      nameToProductId.set(name, newProduct.id)

      // Create an alias so future imports with the same name match automatically
      await db.productAlias.create({
        data: {
          product_id: newProduct.id,
          alias: name.trim(),
          organizationId,
        },
      }).catch(() => {
        // ignore duplicate alias errors
      })

      // Remove from unmatched since we successfully created it
      unmatched.delete(name)
    } catch (err) {
      // Leave it in unmatched — it will be reported in the final result
      console.error(`[commitSalesImport] Failed to auto-create product "${name}":`, err)
    }
  }

  // Refresh matcher cache so any subsequent calls in the same process see new products
  clearAliasCache(organizationId)

  // Group resolved rows by order_number
  type OrderGroup = {
    order_number: string
    customer_name: string
    branch_code: string | null
    invoice_date: Date
    lines: Array<{
      source_row: number
      product_id: string
      qty: number
      unit_price: number
      raw_name: string
      notes: string | null
    }>
  }

  const orderGroups = new Map<string, OrderGroup>()

  for (const row of rows) {
    if (!row.raw_product_name || !row.qty || !row.movement_date) {
      result.skipped++
      continue
    }
    const productId = nameToProductId.get(row.raw_product_name)
    if (!productId) {
      const u = unmatched.get(row.raw_product_name)!
      u.rows.push(row.source_row)
      u.total_qty += row.qty
      result.skipped++
      continue
    }

    const orderKey = row.order_number ?? `NO-NUM-${row.source_row}`

    if (!orderGroups.has(orderKey)) {
      orderGroups.set(orderKey, {
        order_number: orderKey,
        customer_name: row.customer_name ?? 'Walk-in customer',
        branch_code: row.branch ?? 'mombasa',
        invoice_date: row.movement_date,
        lines: [],
      })
    }
    orderGroups.get(orderKey)!.lines.push({
      source_row: row.source_row,
      product_id: productId,
      qty: row.qty,
      unit_price: row.unit_price ?? 0,
      raw_name: row.raw_product_name,
      notes: row.notes,
    })
  }

  // Ensure the import-placeholder Design exists for THIS org
  let importDesignId: string
  try {
    let design = await db.design.findFirst({ where: { code: 'IMPORTED' } })
    if (!design) {
      design = await db.design.create({
        data: {
          name: 'Imported products (no design)',
          code: 'IMPORTED',
          description:
            'Placeholder design for products imported from QuickBooks. ' +
            'Replace with proper designs once production setup is complete.',
        },
      })
    }
    importDesignId = design.id
  } catch (err) {
    result.errors.push({ row: 0, error: `Could not create import design: ${(err as Error).message}` })
    return result
  }

  // Write each order group transactionally
  for (const group of Array.from(orderGroups.values())) {
    try {
      const branchId = await resolveBranchId(organizationId, group.branch_code)

      // Idempotency: skip if this invoice number already exists in our org
      const existing = await db.saleOrder.findFirst({ where: { id: group.order_number } })
      if (existing) {
        result.skipped += group.lines.length
        continue
      }

      const totalAmount = group.lines.reduce(
        (sum, l) => sum + l.qty * l.unit_price,
        0
      )

      await withTenantTransaction(organizationId, async (tx) => {
        const order = await tx.saleOrder.create({
          data: {
            id: group.order_number,
            customerName: group.customer_name,
            totalAmount,
            status: 'CONFIRMED',
            createdBy: userId,
          },
        })

        for (const line of group.lines) {
          const product = await tx.product.findFirst({
            where: { id: line.product_id },
            select: { id: true, name: true, sku: true },
          })
          if (!product) continue

          const fgSku = product.sku || product.id
          let finishedGood = await tx.finishedGoods.findFirst({
            where: { sku: fgSku },
          })

          if (!finishedGood) {
            finishedGood = await tx.finishedGoods.create({
              data: {
                sku: fgSku,
                designId: importDesignId,
                quantity: 0,
                kgProduced: 0,
                unitCost: line.unit_price,
              },
            })
          }

          await tx.saleItem.create({
            data: {
              saleOrderId: order.id,
              finishedGoodsId: finishedGood.id,
              quantity: line.qty,
              unitPrice: line.unit_price,
              totalPrice: line.qty * line.unit_price,
            },
          })

          await tx.stockMovement.create({
            data: {
              productId: line.product_id,
              branchId,
              movementType: 'sale',
              quantity: -line.qty,
              reference: group.order_number,
              notes: line.notes ?? `Imported sale to ${group.customer_name}`,
            },
          })

          await tx.product.update({
            where: { id: line.product_id },
            data: { currentStock: { decrement: line.qty } },
          })
        }
      }, { maxWait: 10000, timeout: 30000 })

      result.written += group.lines.length
    } catch (err) {
      result.errors.push({
        row: group.lines[0]?.source_row ?? 0,
        error: `Order ${group.order_number}: ${(err as Error).message}`,
      })
    }
  }

  result.unmatchedNames = Array.from(unmatched.entries())
    .map(([name, info]) => ({
      raw_name: name,
      rows: info.rows,
      total_qty: info.total_qty,
    }))
    .sort((a, b) => b.total_qty - a.total_qty)

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSUMABLES STOCK COMMIT
// ─────────────────────────────────────────────────────────────────────────────

export async function commitConsumablesImport(
  rows: ParsedStockRow[],
  importBatchId: string,
  userId: string,
  organizationId: string
): Promise<CommitResult> {
  const result: CommitResult = {
    total: rows.length,
    written: 0,
    skipped: 0,
    errors: [],
    unmatchedNames: [],
  }

  const uniqueNames = new Set<string>()
  for (const r of rows) {
    if (r.raw_product_name) uniqueNames.add(r.raw_product_name)
  }

  const nameToProductId = new Map<string, string>()
  const unmatched = new Map<string, { rows: number[]; total_qty: number }>()

  for (const name of uniqueNames) {
    const match = await matchProductName(name, organizationId)
    if (match?.product?.id) {
      nameToProductId.set(name, match.product.id)
    } else {
      unmatched.set(name, { rows: [], total_qty: 0 })
    }
  }

  // Pre-resolve branch IDs
  const branchCodes = new Set<string>()
  for (const r of rows) {
    if (r.branch) branchCodes.add(r.branch)
  }
  const branchCodeToId = new Map<string, string | null>()
  for (const code of branchCodes) {
    branchCodeToId.set(code, await resolveBranchId(organizationId, code))
  }

  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)

    await withTenantTransaction(organizationId, async (tx) => {
      for (const row of chunk) {
        if (!row.raw_product_name || row.qty === null) {
          result.skipped++
          continue
        }
        const productId = nameToProductId.get(row.raw_product_name)
        if (!productId) {
          const u = unmatched.get(row.raw_product_name)!
          u.rows.push(row.source_row)
          u.total_qty += row.qty
          result.skipped++
          continue
        }

        const isInbound = row.direction === 'in'
        const signedQty = isInbound ? row.qty : -row.qty
        const movementType = isInbound ? 'stock_in' : 'stock_out'
        const branchId = branchCodeToId.get(row.branch) ?? null

        try {
          await tx.stockMovement.create({
            data: {
              productId,
              branchId,
              movementType,
              quantity: signedQty,
              reference: row.reference ?? `IMPORT-${importBatchId.slice(0, 8)}`,
              notes: row.notes ?? `Imported from consumables sheet`,
            },
          })

          await tx.product.update({
            where: { id: productId },
            data: { currentStock: { increment: signedQty } },
          })

          result.written++
        } catch (err) {
          result.errors.push({
            row: row.source_row,
            error: (err as Error).message,
          })
        }
      }
    }, { maxWait: 10000, timeout: 30000 })
  }

  result.unmatchedNames = Array.from(unmatched.entries())
    .map(([name, info]) => ({
      raw_name: name,
      rows: info.rows,
      total_qty: info.total_qty,
    }))
    .sort((a, b) => b.total_qty - a.total_qty)

  return result
}
