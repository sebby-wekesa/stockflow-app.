'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireActiveAuth, type AuthUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import {
  parseSalesQuickbooks,
  parseSimpleSales,
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
import * as XLSX from 'xlsx'
import { normalizeBranchCode } from '@/lib/branches'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

async function requireImporter(): Promise<AuthUser> {
  const user = await requireActiveAuth()
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Only admins and managers can import data')
  }
  return user
}

async function getImporterBranch(user: AuthUser): Promise<{
  id: string
  code: BranchCode
  name: string
}> {
  const assignedBranch = user.branches[0]
  if (!assignedBranch) {
    throw new Error('Your user account must be assigned to a branch before importing data')
  }

  const db = getTenantPrisma(user.organizationId)
  const branch = await db.branch.findFirst({
    where: { id: assignedBranch.id },
    select: { id: true, name: true, code: true, location: true },
  })
  const code = branch
    ? normalizeBranchCode(branch.code, branch.name, branch.location)
    : null

  if (!branch || !code) {
    throw new Error('Your assigned branch must be Nairobi, Mombasa, or Bunje before importing data')
  }

  return { id: branch.id, code, name: branch.name }
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECIALIZED UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadSpecialized(formData: FormData) {
  const user = await requireImporter()
  const db = getTenantPrisma(user.organizationId)
  const importerBranch = await getImporterBranch(user)
  const file = formData.get('file') as File | null
  const sheetType = formData.get('sheet_type') as SpecializedSheetType | null
  const branchOverride = importerBranch.code

  if (!file || file.size === 0) throw new Error('Please choose a file to upload')
  if (!sheetType) throw new Error('Please pick a file type')

  const buffer = await file.arrayBuffer()

  let parsedCount = 0
  let parsedPreview: unknown[] = []
  let sourceLabel = ''

  try {
    if (sheetType === 'sales_quickbooks_v2') {
      const rows = parseSalesQuickbooks(buffer).map((row) => ({
        ...row,
        branch: branchOverride,
      }))
      parsedCount = rows.length
      parsedPreview = rows.slice(0, 10)
      sourceLabel = 'QuickBooks sales export'
    } else if (sheetType === 'sales_simple') {
      const rows = parseSimpleSales(buffer).map((row) => ({
        ...row,
        branch: branchOverride,
      }))
      parsedCount = rows.length
      parsedPreview = rows.slice(0, 10)
      sourceLabel = 'Simple sales list'
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
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const inOutSheets = wb.SheetNames.filter((n) =>
        n.toUpperCase().includes('IN-OUT')
      )
      const merged: ParsedStockRow[] = []
      for (const name of inOutSheets) {
        try {
          const rows = parseConsumablesStock(buffer, name, branchOverride)
          merged.push(...rows)
        } catch {
          // skip unparseable sheets silently
        }
      }
      parsedCount = merged.length
      parsedPreview = merged.slice(0, 10)
      sourceLabel = `Consumables stock — ${inOutSheets.length} sheets parsed`
    } else {
      throw new Error(`Unknown sheet type: ${sheetType}`)
    }
  } catch (err) {
    throw new Error(`Could not parse file: ${(err as Error).message}`)
  }

  if (parsedCount === 0) {
    throw new Error(
      `No usable rows found in the file (sheet type: ${sheetType}). ` +
      `Check that you selected the correct file type in the Import Centre. ` +
      `Detailed diagnostics were printed to the server console.`
    )
  }

  const base64 = Buffer.from(buffer).toString('base64')

  // organizationId auto-injected
  const batch = await db.importBatch.create({
    data: {
      file_name: file.name,
      file_url: base64,
      sheet_type: sheetType,
      import_mode: 'update',
      target_branch: branchOverride,
      status: 'preview',
      row_count: parsedCount,
      mapping_config: {
        specialized: true,
        source_label: sourceLabel,
        preview: parsedPreview,
      } as object,
      created_by: user.id,
      organizationId: user.organizationId,
    },
  })

  redirect(`/import/specialized/${batch.id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMIT SPECIALIZED BATCH
// ─────────────────────────────────────────────────────────────────────────────

export async function commitSpecializedBatch(batchId: string): Promise<CommitResult> {
  const user = await requireImporter()
  const db = getTenantPrisma(user.organizationId)
  const importerBranch = await getImporterBranch(user)

  const batch = await db.importBatch.findFirst({ where: { id: batchId } })
  if (!batch) throw new Error('Batch not found')
  if (batch.status === 'imported') throw new Error('Already imported')
  if (!batch.file_url) {
    throw new Error('File buffer missing — please re-upload the file')
  }

  const bufNode = Buffer.from(batch.file_url, 'base64')
  const buffer = bufNode.buffer.slice(
    bufNode.byteOffset,
    bufNode.byteOffset + bufNode.byteLength
  ) as ArrayBuffer

  const sheetType = batch.sheet_type as SpecializedSheetType

  clearAliasCache()
  clearBranchCache()

  let result: CommitResult

  try {
    if (sheetType === 'sales_quickbooks_v2') {
      const rows = parseSalesQuickbooks(buffer)
      result = await commitSalesImport(rows, batch.id, user.id, user.organizationId, importerBranch.code)
    } else if (sheetType === 'sales_simple') {
      const rows = parseSimpleSales(buffer)
      result = await commitSalesImport(rows, batch.id, user.id, user.organizationId, importerBranch.code)
    } else if (sheetType === 'springs_master') {
      const rows = parseSpringsList(buffer)
      result = await commitProductMaster(rows, batch.id, user.id, user.organizationId, importerBranch.code)
    } else if (sheetType === 'ubolt_master') {
      const rows = parseUBoltList(buffer)
      result = await commitProductMaster(rows, batch.id, user.id, user.organizationId, importerBranch.code)
    } else if (sheetType === 'consumables_stock') {
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
            importerBranch.code
          )
          merged.push(...parsed)
        } catch {}
      }
      result = await commitConsumablesImport(
        merged,
        batch.id,
        user.id,
        user.organizationId,
        importerBranch.code
      )
    } else {
      throw new Error(`Unknown sheet type: ${sheetType}`)
    }
  } catch (err) {
    await db.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'failed',
        error_summary: `Commit failed: ${(err as Error).message}`,
      },
    })
    throw err
  }

  await db.importBatch.update({
    where: { id: batchId },
    data: {
      status: 'imported',
      target_branch: importerBranch.code,
      ok_count: result.written,
      skipped_count: result.skipped,
      error_count: result.errors.length,
      imported_at: new Date(),
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
// AUTO-DETECT
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
// STUBS FOR MULTITENANCY MERGE (to be implemented properly later)
// These were referenced by components after the Stage 3/4 merge
// ─────────────────────────────────────────────────────────────────────────────

const DEPRECATED_ERROR = 'Legacy generic/unified import flow (with column mapping) is deprecated after multitenancy merge. Use Quick Import (specialized) from the Import Centre for QuickBooks sales, springs/ubolt masters, and consumables stock files.'

export async function approveAndSyncImport(batchId: string) {
  throw new Error(DEPRECATED_ERROR)
}

export async function resolveConflict(rowId: string, resolution: string) {
  throw new Error(DEPRECATED_ERROR)
}

export async function saveColumnMapping(batchId: string, mapping: Record<string, string>) {
  throw new Error(DEPRECATED_ERROR)
}

export async function runUnifiedImport(formData: FormData) {
  throw new Error(DEPRECATED_ERROR)
}

export async function uploadImport(formData: FormData) {
  throw new Error(DEPRECATED_ERROR)
}
