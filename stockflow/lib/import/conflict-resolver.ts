import { prisma } from '@/lib/prisma'
import type { ImportMode } from '@prisma/client'

export type ResolutionAction =
  | { type: 'create_product'; category: string; product_code: string; canonical_name: string }
  | { type: 'use_existing'; product_id: string }
  | { type: 'create_alias'; product_id: string; alias_name: string }

// Resolves a single import row conflict
export async function resolveConflict(importRowId: string, resolution: ResolutionAction) {
  const row = await prisma.importRow.findUniqueOrThrow({
    where: { id: importRowId },
    include: { import_batch: true },
  })

  if (resolution.type === 'create_product') {
    const product = await prisma.product.create({
      data: {
        product_code: resolution.product_code,
        canonical_name: resolution.canonical_name,
        category: resolution.category,
        is_active: true,
      },
    })
    await prisma.importRow.update({
      where: { id: importRowId },
      data: { matched_product_id: product.id, status: 'resolved' },
    })
  } else if (resolution.type === 'use_existing') {
    await prisma.importRow.update({
      where: { id: importRowId },
      data: { matched_product_id: resolution.product_id, status: 'resolved' },
    })
  } else if (resolution.type === 'create_alias') {
    await prisma.productAlias.create({
      data: {
        product_id: resolution.product_id,
        alias_name: row.raw_product_name!,
      },
    })
    await prisma.importRow.update({
      where: { id: importRowId },
      data: { matched_product_id: resolution.product_id, status: 'resolved' },
    })
  }
}

// Commits the entire import batch to stock_movements and sales_orders
export async function commitImport(batchId: string, userId: string) {
  const batch = await prisma.importBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { import_rows: { where: { status: 'resolved' } } },
  })

  const committedRows: string[] = []

  for (const row of batch.import_rows) {
    if (!row.matched_product_id || !row.qty || !row.movement_date) continue

    if (batch.sheet_type === 'sales_quickbooks') {
      // Create sales order
      await prisma.salesOrder.create({
        data: {
          order_number: row.order_number,
          customer_name: row.customer_name,
          product_id: row.matched_product_id,
          quantity: row.qty,
          unit_price: row.unit_price,
          branch: row.branch as any,
          order_date: row.movement_date,
          created_by: userId,
        },
      })
    } else {
      // Create stock movement
      await prisma.stockMovement.create({
        data: {
          product_id: row.matched_product_id,
          quantity: row.qty,
          movement_type: 'adjustment',
          branch: row.branch as any,
          movement_date: row.movement_date,
          notes: row.notes,
          created_by: userId,
        },
      })
    }

    committedRows.push(row.id)
  }

  // Mark rows as committed
  await prisma.importRow.updateMany({
    where: { id: { in: committedRows } },
    data: { status: 'committed' },
  })

  // Mark batch as imported
  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: 'imported', imported_at: new Date() },
  })

  return { committed: committedRows.length }
}