'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  parseSalesQuickbooks,
  parseSpringsList,
  parseUBoltList,
  parseConsumablesStock,
  detectFile,
  type SpecializedSheetType,
  type ParsedStockRow,
  type BranchCode,
} from '@/lib/import/specialized-parsers'
import {
  commitProductMaster,
  commitSalesImport,
  commitConsumablesImport,
  clearBranchCache,
  type CommitResult,
} from '@/lib/import/specialized-commit'
import { clearAliasCache } from '@/lib/import/alias-matcher'
import { parseIncomingWorkbook } from '@/lib/import/unified-parser'
import { commitBundleToSupabase, commitBundleWithPrisma } from '@/lib/import/unified-commit'
import * as XLSX from 'xlsx'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

async function requireImporter() {
  const supabase = await createServerSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')
  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Only admins and managers can import data')
  }
  return user
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECIALIZED UPLOAD
//
// One-shot: parses the file, persists a preview-able batch with the file
// buffer stored as base64 in `file_url`. The user then commits from the
// preview page.
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadSpecialized(formData: FormData) {
  const user = await requireImporter()
  const file = formData.get('file') as File | null
  const sheetType = formData.get('sheet_type') as SpecializedSheetType | null
  const branchOverride = formData.get('branch') as BranchCode | null

  if (!file || file.size === 0) throw new Error('Please choose a file to upload')
  if (!sheetType) throw new Error('Please pick a file type')

  const buffer = await file.arrayBuffer()

  let parsedCount = 0
  let parsedPreview: unknown[] = []
  let sourceLabel = ''

  try {
    if (sheetType === 'sales_quickbooks_v2') {
      const rows = parseSalesQuickbooks(buffer)
      parsedCount = rows.length
      parsedPreview = rows.slice(0, 10)
      sourceLabel = 'QuickBooks sales export'
    } else if (sheetType === 'springs_master') {
      const rows = parseSpringsList(buffer)
      parsedCount = rows.length
      parsedPreview = rows.slice(0, 10)
      sourceLabel = 'Springs master list'
    } else if (sheetType === 'ubolt_master') {
      const rows = parseUBoltList(buffer)
      parsedCount = rows.length
      parsedPreview = rows.slice(0, 10)
      sourceLabel = 'U-bolt master list'
    } else if (sheetType === 'consumables_stock') {
      if (!branchOverride) {
        throw new Error('Pick the branch this file belongs to')
      }
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      // Try all sheets (not just those with "IN-OUT" in the name)
      const merged: ParsedStockRow[] = []
      const sheetsTried: string[] = []
      for (const name of wb.SheetNames) {
        try {
          const rows = parseConsumablesStock(buffer, name, branchOverride)
          if (rows.length > 0) {
            merged.push(...rows)
            sheetsTried.push(`${name} (${rows.length} rows)`)
          }
        } catch {
          // Skip sheets we can't parse — they may have a different layout
        }
      }
      parsedCount = merged.length
      parsedPreview = merged.slice(0, 10)
      sourceLabel = `Consumables stock — ${sheetsTried.length} sheets parsed${
        sheetsTried.length > 0 ? ': ' + sheetsTried.join(', ') : ''
      }`
    } else {
      throw new Error(`Unknown sheet type: ${sheetType}`)
    }
  } catch (err) {
    throw new Error(`Could not parse file: ${(err as Error).message}`)
  }

  if (parsedCount === 0) {
    throw new Error(
      `No usable rows found in the file. Check the format matches ${sourceLabel}. ` +
      `Tried columns 0-3 (Product | In-Qty | Product | Out-Qty) and simple Product | Qty layout.`
    )
  }

  // Store the file buffer base64-encoded for the commit step
  const base64 = Buffer.from(buffer).toString('base64')

  const batch = await prisma.importBatch.create({
    data: {
      file_name: file.name,
      file_url: base64,
      sheet_type: sheetType,
      import_mode: 'update',
      target_branch: branchOverride ?? null,
      status: 'preview',
      row_count: parsedCount,
      mapping_config: {
        specialized: true,
        source_label: sourceLabel,
        preview: parsedPreview,
      } as object,
      created_by: user.id,
    },
  })

  redirect(`/import/specialized/${batch.id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMIT SPECIALIZED BATCH
// ─────────────────────────────────────────────────────────────────────────────

export async function commitSpecializedBatch(batchId: string): Promise<CommitResult> {
  const user = await requireImporter()

  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } })
  if (!batch) throw new Error('Batch not found')
  if (batch.status === 'imported') throw new Error('Already imported')
  if (!batch.file_url) {
    throw new Error('File buffer missing — please re-upload the file')
  }

  // Reconstruct ArrayBuffer from base64
  const bufNode = Buffer.from(batch.file_url, 'base64')
  const buffer = bufNode.buffer.slice(
    bufNode.byteOffset,
    bufNode.byteOffset + bufNode.byteLength
  ) as ArrayBuffer

  const sheetType = batch.sheet_type as SpecializedSheetType

  // Refresh caches before matching
  clearAliasCache()
  clearBranchCache()

  let result: CommitResult

  try {
    if (sheetType === 'sales_quickbooks_v2') {
      const rows = parseSalesQuickbooks(buffer)
      result = await commitSalesImport(rows, batch.id, user.id)
    } else if (sheetType === 'springs_master') {
      const rows = parseSpringsList(buffer)
      result = await commitProductMaster(rows, batch.id, user.id)
    } else if (sheetType === 'ubolt_master') {
      const rows = parseUBoltList(buffer)
      result = await commitProductMaster(rows, batch.id, user.id)
    } else if (sheetType === 'consumables_stock') {
      if (!batch.target_branch) {
        throw new Error('Branch not set on batch')
      }
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const inOutSheets = wb.SheetNames.filter((n) =>
        n.toUpperCase().includes('IN-OUT')
      )
      const merged: ParsedStockRow[] = []
      for (const name of inOutSheets) {
        try {
          const parsed = parseConsumablesStock(
            buffer,
            name,
            batch.target_branch as BranchCode
          )
          merged.push(...parsed)
        } catch {}
      }
      result = await commitConsumablesImport(merged, batch.id, user.id)
    } else {
      throw new Error(`Unknown sheet type: ${sheetType}`)
    }
  } catch (err) {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'failed',
        error_summary: `Commit failed: ${(err as Error).message}`,
      },
    })
    throw err
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: 'imported',
      ok_count: result.written,
      skipped_count: result.skipped,
      error_count: result.errors.length,
      imported_at: new Date(),
      // Clear the base64 buffer to save DB space
      file_url: null,
      error_summary:
        result.errors.length > 0
          ? result.errors
              .slice(0, 50)
              .map((e) => `Row ${e.row}: ${e.error}`)
              .join('\n')
          : null,
    },
  })

  revalidatePath('/import')
  revalidatePath('/products')
  revalidatePath('/sales')
  revalidatePath('/stock')

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-DETECT — used by the upload form to suggest the right type
// ─────────────────────────────────────────────────────────────────────────────

export async function detectUploadedFile(formData: FormData) {
  await requireImporter()
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return {
      recommendedSheetType: 'unknown' as const,
      sheetNames: [],
      reason: 'No file',
    }
  }
  return detectFile(file)
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED IMPORT (auto-detect ledger vs stock matrix)
// Writes to the unified import tables + (optionally) Supabase REST tables.
// ─────────────────────────────────────────────────────────────────────────────

export async function runUnifiedImport(formData: FormData) {
  await requireImporter()

  const file = formData.get('file') as File | null
  const locationOverride = (formData.get('location') as string | null) ?? 'auto'

  if (!file || file.size === 0) throw new Error('Please choose a file to upload')

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const bundle = parseIncomingWorkbook(workbook, file.name)
  if (locationOverride !== 'auto' && (locationOverride === 'Mombasa' || locationOverride === 'Nairobi')) {
    bundle.location = locationOverride
  }

  const parsedCounts = {
    products: bundle.products.length,
    sales: bundle.sales.length,
    purchases: bundle.purchases.length,
  }

  if (parsedCounts.products + parsedCounts.sales + parsedCounts.purchases === 0) {
    throw new Error('No usable rows found in this workbook. Check the file format and sheet names.')
  }

  const prisma = await commitBundleWithPrisma(bundle).catch((err) => ({
    productsUpserted: 0,
    salesInserted: 0,
    purchasesInserted: 0,
    errors: [`prisma: ${(err as Error).message}`],
  }))

  const supabase = await commitBundleToSupabase(bundle).catch((err) => ({
    productsUpserted: 0,
    salesInserted: 0,
    purchasesInserted: 0,
    errors: [`supabase: ${(err as Error).message}`],
  }))

  revalidatePath('/reports')
  revalidatePath('/sales')
  revalidatePath('/stock')

  return {
    location: bundle.location,
    parsedCounts,
    prisma,
    supabase,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY IMPORT ACTIONS (for column mapping and conflict resolution)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveColumnMapping(batchId: string, mappings: Record<string, string>) {
  const user = await requireImporter()
  
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } })
  if (!batch) throw new Error('Batch not found')
  if (batch.created_by !== user.id) throw new Error('Not authorized')
  
  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      mapping_config: {
        ...((batch.mapping_config as any) || {}),
        column_mappings: mappings,
      },
    },
  })
  
  revalidatePath(`/import/${batchId}`)
}

export async function resolveConflict(batchId: string, rowId: string, productId: string) {
  const user = await requireImporter()
  
  const row = await prisma.importRow.findUnique({ where: { id: rowId } })
  if (!row || row.batch_id !== batchId) throw new Error('Row not found')
  
  await prisma.importRow.update({
    where: { id: rowId },
    data: {
      resolved_product: productId,
      resolution: 'manual',
      match_confidence: 1.0,
    },
  })
  
  revalidatePath(`/import/${batchId}`)
}

export async function approveAndSyncImport(batchId: string) {
  const user = await requireImporter()
  
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { ImportRow: true },
  })
  if (!batch) throw new Error('Batch not found')
  if (batch.status === 'imported') throw new Error('Already imported')
  
  // TODO: Implement actual sync logic based on batch type
  // For now, just mark as imported
  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: 'imported',
      imported_at: new Date(),
      ok_count: batch.ImportRow.length,
    },
  })
  
  revalidatePath('/import')
  revalidatePath(`/import/${batchId}`)
}
