'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireActiveAuth, type AuthUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { RAW_MATERIAL_CATEGORIES, normalizeRawMaterialCategory } from '@/lib/raw-materials'

async function requireWarehouseAccess(): Promise<AuthUser> {
  const user = await requireActiveAuth()
  if (!['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(user.role)) {
    throw new Error('Only admins, managers, and warehouse staff can manage raw materials')
  }
  return user
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE A NEW RAW MATERIAL TYPE
//
// Schema fields: sku, materialName, category, diameter, length,
// width/diameter, height,
// supplierId?, batchNumber?,
// availableKg, reservedKg, availablePieces, costPerKg
// ─────────────────────────────────────────────────────────────────────────────

const createRMSchema = z.object({
  sku: z.string().min(1).max(60),
  materialName: z.string().min(1).max(200),
  category: z.enum(RAW_MATERIAL_CATEGORIES).default('Flat Bars'),
  diameter: z.string().min(1).max(50),
  length: z.string().min(1).max(50),
  width: z.string().min(1).max(50),
  height: z.string().min(1).max(50),
  availablePieces: z.coerce.number().int().nonnegative().optional().default(0),
  supplierId: z.string().optional().nullable(),
  costPerKg: z.coerce.number().nonnegative().optional().nullable(),
})

export async function createRawMaterial(formData: FormData) {
  const user = await requireWarehouseAccess()
  const db = getTenantPrisma(user.organizationId)

  const raw = {
    sku: formData.get('sku'),
    materialName: formData.get('materialName'),
    category: formData.get('category') || 'Flat Bars',
    diameter: formData.get('diameter'),
    length: formData.get('length'),
    width: formData.get('width'),
    height: formData.get('height'),
    availablePieces: formData.get('availablePieces') || 0,
    supplierId: formData.get('supplierId') || null,
    costPerKg: formData.get('costPerKg') || null,
  }

  const parsed = createRMSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const existing = await db.rawMaterial.findFirst({
    where: { sku: parsed.data.sku },
  })
  if (existing) throw new Error(`SKU "${parsed.data.sku}" already exists`)

  await db.rawMaterial.create({
    data: {
      sku: parsed.data.sku,
      materialName: parsed.data.materialName,
      category: parsed.data.category,
      diameter: parsed.data.diameter,
      length: parsed.data.length,
      width: parsed.data.width,
      height: parsed.data.height,
      availablePieces: parsed.data.availablePieces,
      supplierId: parsed.data.supplierId ?? null,
      costPerKg: parsed.data.costPerKg ?? undefined,
      organizationId: user.organizationId,
    },
  })

  revalidatePath('/raw-materials')
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIVE A SINGLE BATCH OF RAW MATERIAL — manual entry
// ─────────────────────────────────────────────────────────────────────────────

const receiveRMSchema = z.object({
  rawMaterialId: z.string().min(1),
  kgReceived: z.coerce.number().positive(),
  piecesReceived: z.coerce.number().int().positive(),
  branchId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
})

export async function receiveRawMaterial(formData: FormData) {
  const user = await requireWarehouseAccess()

  const raw = {
    rawMaterialId: formData.get('rawMaterialId'),
    kgReceived: formData.get('kgReceived'),
    piecesReceived: formData.get('piecesReceived'),
    branchId: formData.get('branchId') || null,
    supplierId: formData.get('supplierId') || null,
    reference: formData.get('reference') || null,
  }

  const parsed = receiveRMSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)
  const data = parsed.data

  const { withTenantTransaction } = await import('@/lib/tenant-prisma')
  await withTenantTransaction(user.organizationId, async (tx) => {
      await tx.materialReceipt.create({
        data: {
          id: crypto.randomUUID(),
          materialId: data.rawMaterialId,
          kgReceived: new Prisma.Decimal(data.kgReceived),
          piecesReceived: data.piecesReceived,
          branchId: data.branchId,
          supplierId: data.supplierId,
          reference: data.reference,
          loggedBy: user.id,
        },
      })

      await tx.rawMaterial.update({
        where: { id: data.rawMaterialId },
        data: {
          availableKg: { increment: new Prisma.Decimal(data.kgReceived) },
          availablePieces: { increment: data.piecesReceived },
        },
      })
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/raw-materials')
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE A RECEIPT AND KEEP RAW MATERIAL BALANCES IN SYNC
// ─────────────────────────────────────────────────────────────────────────────

const updateReceiptSchema = z.object({
  receiptId: z.string().min(1),
  kgReceived: z.coerce.number().positive(),
  piecesReceived: z.coerce.number().int().positive(),
  reference: z.string().max(200).optional().nullable(),
})

export async function updateRawMaterialReceipt(formData: FormData) {
  const user = await requireWarehouseAccess()

  const parsed = updateReceiptSchema.safeParse({
    receiptId: formData.get('receiptId'),
    kgReceived: formData.get('kgReceived'),
    piecesReceived: formData.get('piecesReceived'),
    reference: formData.get('reference') || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)
  const data = parsed.data

  const { withTenantTransaction } = await import('@/lib/tenant-prisma')
  await withTenantTransaction(user.organizationId, async (tx) => {
    const receipt = await tx.materialReceipt.findUnique({
      where: { id: data.receiptId },
      include: { RawMaterial: true },
    })

    if (!receipt) {
      throw new Error('Receipt not found')
    }

    const oldKg = Number(receipt.kgReceived)
    const oldPieces = Number(receipt.piecesReceived)
    const kgDelta = data.kgReceived - oldKg
    const piecesDelta = data.piecesReceived - oldPieces
    const nextAvailableKg = Number(receipt.RawMaterial.availableKg) + kgDelta
    const nextAvailablePieces = Number(receipt.RawMaterial.availablePieces) + piecesDelta

    if (nextAvailableKg < 0) {
      throw new Error('Cannot reduce received kg below current available stock')
    }
    if (nextAvailablePieces < 0) {
      throw new Error('Cannot reduce received pieces below current available stock')
    }

    await tx.materialReceipt.update({
      where: { id: data.receiptId },
      data: {
        kgReceived: new Prisma.Decimal(data.kgReceived),
        piecesReceived: data.piecesReceived,
        reference: data.reference,
      },
    })

    await tx.rawMaterial.update({
      where: { id: receipt.materialId },
      data: {
        availableKg: { increment: new Prisma.Decimal(kgDelta) },
        availablePieces: { increment: piecesDelta },
      },
    })
  }, { maxWait: 10000, timeout: 30000 })

  revalidatePath('/rawmaterials')
  revalidatePath('/raw-materials')
  revalidatePath('/inventory')
  revalidatePath('/warehouse')
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIVE BATCH FROM EXCEL UPLOAD
//
// Called from components/inventory/ExcelRawMaterialUpload.tsx. Each row is
// expected to be a flat object with at least { sku, materialName, diameter,
// length, width/diameter, height, kgReceived, piecesReceived }. Missing materials are auto-created.
// ─────────────────────────────────────────────────────────────────────────────

export type RawMaterialBatchResult = {
  success: boolean
  results?: {
    success: number  // count of rows successfully processed
    failed: number   // count of rows that failed
    errors: string[] // human-readable error strings
  }
  error?: string
}

export async function receiveRawMaterialsBatch(
  rows: Array<Record<string, unknown>>
): Promise<RawMaterialBatchResult> {
  let user
  try {
    user = await requireWarehouseAccess()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: 'No rows to process' }
  }

  const { withTenantTransaction } = await import('@/lib/tenant-prisma')
  let successCount = 0
  const errors: string[] = []

  // Helpers to read columns under various casings
  const pick = (row: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) {
      const lower = k.toLowerCase()
      for (const rk of Object.keys(row)) {
        if (rk.toLowerCase() === lower) return row[rk]
      }
    }
    return undefined
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // user-facing 1-indexed, after header row
    try {
      const skuVal = pick(row, 'sku', 'code', 'product_code')
      const nameVal = pick(row, 'material_name', 'materialName', 'name', 'description')
      const categoryVal = pick(row, 'category', 'material_category', 'materialCategory')
      const diameterVal = pick(row, 'diameter', 'size', 'spec')
      const lengthVal = pick(row, 'length', 'material_length', 'materialLength')
      const widthVal = pick(row, 'width', 'width_diameter', 'widthDiameter', 'width/diameter', 'material_width', 'materialWidth')
      const heightVal = pick(row, 'height', 'material_height', 'materialHeight')
      const kgVal = pick(row, 'kg_received', 'kgReceived', 'quantity', 'qty', 'kg')
      const piecesVal = pick(row, 'pieces_received', 'piecesReceived', 'pieces', 'piece_count', 'pieceCount', 'pcs')
      const costVal = pick(row, 'cost_per_kg', 'costPerKg', 'unit_cost')

      const sku = String(skuVal ?? '').trim()
      const name = String(nameVal ?? '').trim()
      const category = normalizeRawMaterialCategory(String(categoryVal ?? '').trim())
      const diameter = String(diameterVal ?? '').trim()
      const length = String(lengthVal ?? '').trim()
      const width = String(widthVal ?? '').trim()
      const height = String(heightVal ?? '').trim()
      const kg = Number(kgVal)
      const pieces = Number(piecesVal)

      if (!sku || !name || !diameter || !length || !width || !height) {
        errors.push(
          `Row ${rowNum}: missing required fields (sku, materialName, diameter, length, width/diameter, height)`
        )
        continue
      }
      if (!Number.isFinite(kg) || kg <= 0) {
        errors.push(`Row ${rowNum}: invalid or missing kgReceived`)
        continue
      }
      if (!Number.isInteger(pieces) || pieces <= 0) {
        errors.push(`Row ${rowNum}: invalid or missing piecesReceived`)
        continue
      }

      await withTenantTransaction(user.organizationId, async (tx) => {
          let material = await tx.rawMaterial.findUnique({ where: { sku } })

          if (!material) {
            material = await tx.rawMaterial.create({
              data: {
                sku,
                materialName: name,
                category,
                diameter,
                length,
                width,
                height,
                costPerKg: Number.isFinite(Number(costVal)) ? Number(costVal) : undefined,
                availableKg: new Prisma.Decimal(kg),
                availablePieces: pieces,
              },
            })
          } else {
            await tx.rawMaterial.update({
              where: { id: material.id },
              data: {
                availableKg: { increment: new Prisma.Decimal(kg) },
                availablePieces: { increment: pieces },
              },
            })
          }

          await tx.materialReceipt.create({
            data: {
              id: crypto.randomUUID(),
              materialId: material.id,
              kgReceived: new Prisma.Decimal(kg),
              piecesReceived: pieces,
              reference: `Excel upload row ${rowNum}`,
              loggedBy: user.id,
            },
          })
      }, { maxWait: 10000, timeout: 30000 })

      successCount++
    } catch (err) {
      errors.push(`Row ${rowNum}: ${(err as Error).message}`)
    }
  }

  revalidatePath('/raw-materials')

  return {
    success: successCount > 0,
    results: {
      success: successCount,
      failed: errors.length,
      errors,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH RAW MATERIALS
// ─────────────────────────────────────────────────────────────────────────────

export async function searchRawMaterials(query: string) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  if (!query || query.length < 1) {
    return db.rawMaterial.findMany({
      orderBy: { sku: 'asc' },
      take: 20,
    })
  }

  return db.rawMaterial.findMany({
    where: {
      OR: [
        { sku: { contains: query, mode: 'insensitive' } },
        { materialName: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
        { diameter: { contains: query, mode: 'insensitive' } },
        { length: { contains: query, mode: 'insensitive' } },
        { width: { contains: query, mode: 'insensitive' } },
        { height: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { sku: 'asc' },
    take: 20,
  })
}
