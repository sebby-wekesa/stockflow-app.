'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  parseExcelFile,
  suggestMapping,
  extractDate,
  extractNumber,
  extractString,
  extractBranch,
  type SheetType,
  type ImportField,
} from '@/lib/import/parsers'
import { matchImportBatch } from '@/lib/import/alias-matcher'
import {
  resolveConflict as resolveConflictHelper,
  commitImport as commitImportHelper,
  type ResolutionAction,
} from '@/lib/import/conflict-resolver'
import type { Branch, ImportMode } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPER
// ─────────────────────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = createServerSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')

  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')

  if (user.role !== 'admin' && user.role !== 'manager') {
    throw new Error('Only admins and managers can import data')
  }

  return user
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — UPLOAD
// Receives the file, parses it, creates an ImportBatch + ImportRow records
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadImport(formData: FormData) {
  const user = await requireUser()

  const file = formData.get('file') as File | null
  const sheetType = formData.get('sheet_type') as SheetType | null
  const importMode = formData.get('import_mode') as ImportMode | null
  const targetBranch = formData.get('branch') as string | null

  if (!file || file.size === 0) {
    throw new Error('Please select a file to upload')
  }
  if (!sheetType) throw new Error('Please choose a file type')
  if (!importMode) throw new Error('Please choose an import mode')

  // Parse the file
  let parsed
  try {
    parsed = await parseExcelFile(file)
  } catch (err) {
    throw new Error(`Could not read file: ${(err as Error).message}`)
  }

  if (parsed.totalRows === 0) {
    throw new Error('The file contains no data rows')
  }

  // Create the import batch
  const batch = await prisma.importBatch.create({
    data: {
      file_name: file.name,
      sheet_type: sheetType,
      import_mode: importMode,
      branch: targetBranch && targetBranch !== 'auto' ? (targetBranch as Branch) : null,
      status: 'mapping',
      row_count: parsed.totalRows,
      mapping_config: suggestMapping(parsed.headers, sheetType),
      created_by: user.id,
    },
  })

  // Create ImportRow records — one per Excel row, raw_data only at this point
  // Mapping happens in step 2. Bulk insert in chunks to avoid query size limits.
  const CHUNK_SIZE = 500
  for (let i = 0; i < parsed.rows.length; i += CHUNK_SIZE) {
    const chunk = parsed.rows.slice(i, i + CHUNK_SIZE)
    await prisma.importRow.createMany({
      data: chunk.map((row, idx) => ({
        import_batch_id: batch.id,
        row_number: i + idx + 2, // +2: header is row 1, data starts at row 2
        raw_data: row as any,
      })),
    })
  }

  redirect(`/import/${batch.id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — APPLY MAPPING
// Takes the user-confirmed column → field mapping and parses each row's values
// ─────────────────────────────────────────────────────────────────────────────

export async function applyMapping(batchId: string, formData: FormData) {
  await requireUser()

  // Build mapping object from form data: each form field is "map_<header>" → field
  const mapping: Record<string, ImportField> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('map_') && typeof value === 'string') {
      const header = key.slice(4)
      mapping[header] = value as ImportField
    }
  }

  // Persist the mapping on the batch
  await prisma.importBatch.update({
    where: { id: batchId },
    data: { mapping_config: mapping, status: 'validating' },
  })

  // Find which header maps to which field
  const headerByField: Partial<Record<ImportField, string>> = {}
  for (const [header, field] of Object.entries(mapping)) {
    if (field !== 'ignore' && !headerByField[field]) {
      headerByField[field] = header
    }
  }

  // Pull all rows and apply mapping to populate typed columns
  const rows = await prisma.importRow.findMany({
    where: { import_batch_id: batchId },
    orderBy: { row_number: 'asc' },
  })

  for (const row of rows) {
    const data = row.raw_data as Record<string, unknown>
    const get = (field: ImportField) => {
      const header = headerByField[field]
      return header ? data[header] : undefined
    }

    const movementDate = extractDate(get('movement_date'))
    const qty = extractNumber(get('qty'))
    const unitPrice = extractNumber(get('unit_price'))
    const branch = extractBranch(get('branch'))

    const errors: string[] = []
    if (!movementDate) errors.push('Missing or invalid date')
    if (qty === null) errors.push('Missing or invalid quantity')
    if (!extractString(get('raw_product_name'))) errors.push('Missing product name')

    await prisma.importRow.update({
      where: { id: row.id },
      data: {
        raw_product_name: extractString(get('raw_product_name')),
        qty: qty !== null ? Math.round(Math.abs(qty)) : null, // sales qty can be negative; we store magnitude
        unit_price: unitPrice ?? undefined,
        movement_date: movementDate,
        branch: branch ?? undefined,
        order_number: extractString(get('order_number')),
        customer_name: extractString(get('customer_name')),
        supplier_name: extractString(get('supplier_name')),
        notes: extractString(get('notes')),
        validation_errors: errors,
        status: errors.length > 0 ? 'error' : 'ok',
      },
    })
  }

  // Run alias matching now that we have raw_product_name set on each row
  await matchImportBatch(batchId)

  revalidatePath(`/import/${batchId}`)
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
  await resolveConflictHelper(importRowId, resolution)
  revalidatePath(`/import/${batchId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — APPROVE & COMMIT
// Final write of all rows to stock_movements and sales_orders
// ─────────────────────────────────────────────────────────────────────────────

export async function approveAndCommit(batchId: string) {
  const user = await requireUser()

  // Mark batch as approved before committing
  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: 'approved' },
  })

  const result = await commitImportHelper(batchId, user.id)

  revalidatePath('/import')
  revalidatePath(`/import/${batchId}`)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL — discard a batch before commit
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelImport(batchId: string) {
  await requireUser()
  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } })
  if (batch.status === 'imported') {
    throw new Error('Cannot cancel an already-imported batch')
  }
  // Delete rows then batch
  await prisma.importRow.deleteMany({ where: { import_batch_id: batchId } })
  await prisma.importBatch.delete({ where: { id: batchId } })
  redirect('/import')
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — search products for the conflict resolution mapper
// ─────────────────────────────────────────────────────────────────────────────

export async function searchProductsForMapping(query: string) {
  await requireUser()
  if (!query || query.length < 2) return []
  const products = await prisma.product.findMany({
    where: {
      is_active: true,
      OR: [
        { product_code: { contains: query, mode: 'insensitive' } },
        { canonical_name: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 10,
    orderBy: { product_code: 'asc' },
    select: { id: true, product_code: true, canonical_name: true, category: true },
  })
  return products
}
