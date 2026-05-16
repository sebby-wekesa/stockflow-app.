/**
 * Specialized commit layer — writes parsed Excel rows to the actual schema.
 *
 * Schema notes:
 *   - Products use camelCase (productId, branchId, currentStock, unitCost)
 *   - Product.name is the canonical name (no canonical_name field)
 *   - StockMovement is a simple audit log: productId, branchId, movementType, quantity
 *   - ProductAlias is the ONLY model using snake_case (product_id)
 *   - Stock is tracked on Product.currentStock directly (no per-branch BranchStock)
 *   - SaleOrder has totalAmount, customerId, customerName, status, createdBy
 *   - SaleItem links to FinishedGoods (not Product directly). For imported sales
 *     we create a FinishedGoods shadow record per imported product.
 */

import { prisma } from '@/lib/prisma'
import { normaliseForMatching, matchProductName } from './alias-matcher'
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

const branchCache = new Map<string, string | null>()

async function resolveBranchId(code: string | null | undefined): Promise<string | null> {
  if (!code) return null
  const normalized = code.toLowerCase().trim()
  if (branchCache.has(normalized)) return branchCache.get(normalized)!

  const branch = await prisma.branch.findFirst({
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
  branchCache.set(normalized, result)
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
  userId: string
): Promise<CommitResult> {
  const result: CommitResult = { total: rows.length, written: 0, skipped: 0, errors: [] }

  const CHUNK = 50
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)

    await prisma.$transaction(
      async (tx) => {
        for (const row of chunk) {
          try {
            const sku = generateSku(row.product_code, row.canonical_name)
            if (!sku) {
              result.skipped++
              continue
            }

            const product = await tx.product.upsert({
              where: { sku },
              update: {
                name: row.canonical_name,
                category: mapCategory(row.category),
                uom: row.uom?.toUpperCase() ?? 'PCS',
                ...(row.cost_price !== null && { unitCost: row.cost_price }),
              },
              create: {
                name: row.canonical_name,
                sku,
                category: mapCategory(row.category),
                origin: 'FACTORY_MADE',
                uom: row.uom?.toUpperCase() ?? 'PCS',
                currentStock: 0,
                unitCost: row.cost_price ?? null,
              },
            })

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
      },
      { maxWait: 10000, timeout: 30000 }
    )
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// SALES COMMIT
// ─────────────────────────────────────────────────────────────────────────────

export async function commitSalesImport(
  rows: ParsedSalesRow[],
  importBatchId: string,
  userId: string
): Promise<CommitResult> {
  const result: CommitResult = {
    total: rows.length,
    written: 0,
    skipped: 0,
    errors: [],
    unmatchedNames: [],
  }

  // Match every raw_product_name once
  const uniqueNames = new Set<string>()
  for (const r of rows) {
    if (r.raw_product_name) uniqueNames.add(r.raw_product_name)
  }

  const nameToProductId = new Map<string, string>()
  const unmatched = new Map<string, { rows: number[]; total_qty: number }>()

  for (const name of uniqueNames) {
    const match = await matchProductName(name)
    if (match?.product?.id) {
      nameToProductId.set(name, match.product.id)
    } else {
      unmatched.set(name, { rows: [], total_qty: 0 })
    }
  }

  // Group resolved rows by order_number (invoice)
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

  // Ensure the import-placeholder Design exists before we start the loop
  let importDesignId: string
  try {
    let design = await prisma.design.findUnique({ where: { code: 'IMPORTED' } })
    if (!design) {
      design = await prisma.design.create({
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
      const branchId = await resolveBranchId(group.branch_code)

      // Skip if this order already exists (idempotency on order_number used as id)
      const existing = await prisma.saleOrder.findUnique({
        where: { id: group.order_number },
      })
      if (existing) {
        result.skipped += group.lines.length
        continue
      }

      const totalAmount = group.lines.reduce(
        (sum, l) => sum + l.qty * l.unit_price,
        0
      )

      await prisma.$transaction(
        async (tx) => {
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
            const product = await tx.product.findUnique({
              where: { id: line.product_id },
              select: { id: true, name: true, sku: true },
            })
            if (!product) continue

            // Get or create FinishedGoods shadow record so SaleItem can reference it
            const fgSku = product.sku || product.id
            let finishedGood = await tx.finishedGoods.findUnique({
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
        },
        { maxWait: 10000, timeout: 30000 }
      )

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
  userId: string
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
    const match = await matchProductName(name)
    if (match?.product?.id) {
      nameToProductId.set(name, match.product.id)
    } else {
      unmatched.set(name, { rows: [], total_qty: 0 })
    }
  }

  // Resolve branch IDs upfront (typically one branch per file)
  const branchCodes = new Set<string>()
  for (const r of rows) {
    if (r.branch) branchCodes.add(r.branch)
  }
  const branchCodeToId = new Map<string, string | null>()
  for (const code of branchCodes) {
    branchCodeToId.set(code, await resolveBranchId(code))
  }

  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)

    await prisma.$transaction(
      async (tx) => {
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
      },
      { maxWait: 10000, timeout: 30000 }
    )
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
