// Category-specific processors for Mombasa stock imports
import { PrismaClient } from '@prisma/client'

export interface ProcessedProduct {
  name: string
  sku?: string
  category: string
  balance: number
  reorderLevel?: number
  unitCost?: number
  vendor?: string
  uom?: string
  rawData: Record<string, any>
}

export interface CategoryProcessor {
  categoryName: string
  detectCategory: (headers: string[]) => boolean
  processRow: (row: Record<string, any>) => ProcessedProduct | null
  generateSKU: (product: ProcessedProduct) => string
}

// Trailer Parts Processor
export const trailerPartsProcessor: CategoryProcessor = {
  categoryName: 'Trailer Parts',

  detectCategory: (headers: string[]) => {
    const lowerHeaders = headers.map(h => h.toLowerCase())
    return lowerHeaders.some(h =>
      h.includes('axle') ||
      h.includes('trailer') ||
      h.includes('hitch') ||
      h.includes('coupling') ||
      h.includes('suspension')
    )
  },

  processRow: (row: Record<string, any>) => {
    const name = row['PRODUCT DESCRIPTION'] || row['DESCRIPTION'] || row['ITEM']
    const balance = parseFloat(row['BALANCE STOCK'] || row['STOCKS'] || row['CURRENT STOCK'] || '0')
    const reorderLevel = parseFloat(row['RE-ORDER STOCK'] || row['MIN STOCK'] || '0')
    const unitCost = parseFloat(row['UNIT COST'] || row['COST'] || '0')
    const vendor = row['VENDOR'] || row['SUPPLIER']

    if (!name || balance <= 0) return null

    return {
      name: name.trim(),
      category: 'Trailer Parts',
      balance,
      reorderLevel: reorderLevel > 0 ? reorderLevel : Math.max(1, Math.floor(balance * 0.2)), // 20% of balance as default
      unitCost: unitCost > 0 ? unitCost : undefined,
      vendor: vendor?.trim(),
      uom: 'PCS',
      rawData: row
    }
  },

  generateSKU: (product: ProcessedProduct) => {
    const cleanName = product.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
    const categoryCode = 'TP' // Trailer Parts
    return `${categoryCode}-${cleanName}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
  }
}

// Brake Linings Processor
export const brakeLiningsProcessor: CategoryProcessor = {
  categoryName: 'Brake Components',

  detectCategory: (headers: string[]) => {
    const lowerHeaders = headers.map(h => h.toLowerCase())
    return lowerHeaders.some(h =>
      h.includes('brake') ||
      h.includes('lining') ||
      h.includes('pad') ||
      h.includes('shoe') ||
      h.includes('drum')
    )
  },

  processRow: (row: Record<string, any>) => {
    const name = row['PRODUCT DESCRIPTION'] || row['BRAKE TYPE'] || row['DESCRIPTION']
    const balance = parseFloat(row['BALANCE STOCK'] || row['STOCKS'] || '0')
    const reorderLevel = parseFloat(row['RE-ORDER STOCK'] || '0')
    const unitCost = parseFloat(row['UNIT COST'] || '0')
    const vendor = row['VENDOR'] || row['SUPPLIER']

    if (!name || balance <= 0) return null

    return {
      name: name.trim(),
      category: 'Brake Components',
      balance,
      reorderLevel: reorderLevel > 0 ? reorderLevel : Math.max(2, Math.floor(balance * 0.15)), // 15% for brake parts
      unitCost: unitCost > 0 ? unitCost : undefined,
      vendor: vendor?.trim(),
      uom: 'PCS',
      rawData: row
    }
  },

  generateSKU: (product: ProcessedProduct) => {
    const cleanName = product.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
    const categoryCode = 'BC' // Brake Components
    return `${categoryCode}-${cleanName}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
  }
}

// Spring Components Processor
export const springComponentsProcessor: CategoryProcessor = {
  categoryName: 'Spring Components',

  detectCategory: (headers: string[]) => {
    const lowerHeaders = headers.map(h => h.toLowerCase())
    return lowerHeaders.some(h =>
      h.includes('spring') ||
      h.includes('leaf') ||
      h.includes('coil') ||
      h.includes('helper') ||
      h.includes('auxiliary')
    )
  },

  processRow: (row: Record<string, any>) => {
    const name = row['PRODUCT DESCRIPTION'] || row['SPRING TYPE'] || row['DESCRIPTION']
    const balance = parseFloat(row['BALANCE STOCK'] || row['STOCKS'] || '0')
    const reorderLevel = parseFloat(row['RE-ORDER STOCK'] || '0')
    const unitCost = parseFloat(row['UNIT COST'] || '0')
    const vendor = row['VENDOR'] || row['SUPPLIER']

    if (!name || balance <= 0) return null

    return {
      name: name.trim(),
      category: 'Spring Components',
      balance,
      reorderLevel: reorderLevel > 0 ? reorderLevel : Math.max(1, Math.floor(balance * 0.25)), // 25% for springs
      unitCost: unitCost > 0 ? unitCost : undefined,
      vendor: vendor?.trim(),
      uom: 'PCS',
      rawData: row
    }
  },

  generateSKU: (product: ProcessedProduct) => {
    const cleanName = product.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
    const categoryCode = 'SC' // Spring Components
    return `${categoryCode}-${cleanName}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
  }
}

// Generic processor for unrecognized categories
export const genericProcessor: CategoryProcessor = {
  categoryName: 'General Parts',

  detectCategory: () => true, // Fallback processor

  processRow: (row: Record<string, any>) => {
    const name = row['PRODUCT DESCRIPTION'] || row['DESCRIPTION'] || row['ITEM'] || row['NAME']
    const balance = parseFloat(row['BALANCE STOCK'] || row['STOCKS'] || row['CURRENT STOCK'] || row['QTY'] || '0')
    const reorderLevel = parseFloat(row['RE-ORDER STOCK'] || row['MIN STOCK'] || '0')
    const unitCost = parseFloat(row['UNIT COST'] || row['COST'] || row['PRICE'] || '0')
    const vendor = row['VENDOR'] || row['SUPPLIER']

    if (!name || balance <= 0) return null

    return {
      name: name.trim(),
      category: 'General Parts',
      balance,
      reorderLevel: reorderLevel > 0 ? reorderLevel : Math.max(1, Math.floor(balance * 0.2)),
      unitCost: unitCost > 0 ? unitCost : undefined,
      vendor: vendor?.trim(),
      uom: 'PCS',
      rawData: row
    }
  },

  generateSKU: (product: ProcessedProduct) => {
    const cleanName = product.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
    const categoryCode = 'GP' // General Parts
    return `${categoryCode}-${cleanName}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
  }
}

// Main processor registry
export const categoryProcessors: CategoryProcessor[] = [
  trailerPartsProcessor,
  brakeLiningsProcessor,
  springComponentsProcessor,
  genericProcessor // Must be last as fallback
]

// Detect category from headers
export function detectCategory(headers: string[]): CategoryProcessor {
  for (const processor of categoryProcessors) {
    if (processor.detectCategory(headers)) {
      return processor
    }
  }
  return genericProcessor // Fallback
}

// Process inventory import with category-specific logic
export async function processMombasaInventory(
  batchId: string,
  rows: any[],
  headers: string[],
  userId: string
) {
  const prisma = new PrismaClient()
  const processor = detectCategory(headers)

  console.log(`Processing ${rows.length} rows as ${processor.categoryName} category`)

  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    category: processor.categoryName
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      try {
        const processedProduct = processor.processRow(row)

        if (!processedProduct) {
          results.skipped++
          continue
        }

        // Generate SKU if not provided
        if (!processedProduct.sku) {
          processedProduct.sku = processor.generateSKU(processedProduct)
        }

        // Determine stock status
        const stockStatus = processedProduct.balance <= 0 ? 'OUT_OF_STOCK' :
                           processedProduct.reorderLevel && processedProduct.balance <= processedProduct.reorderLevel ? 'REORDER_NEEDED' :
                           processedProduct.reorderLevel && processedProduct.balance <= processedProduct.reorderLevel * 1.5 ? 'LOW_STOCK' :
                           'AVAILABLE'

        // Upsert product
        const product = await tx.product.upsert({
          where: { sku: processedProduct.sku },
          update: {
            currentStock: processedProduct.balance,
            reorderLevel: processedProduct.reorderLevel,
            unitCost: processedProduct.unitCost,
            vendor: processedProduct.vendor,
            stockStatus: stockStatus,
            updatedAt: new Date(),
          },
          create: {
            name: processedProduct.name,
            sku: processedProduct.sku,
            category: processedProduct.category as any,
            origin: 'LOCAL_PURCHASE',
            uom: processedProduct.uom || 'PCS',
            currentStock: processedProduct.balance,
            unitCost: processedProduct.unitCost,
            vendor: processedProduct.vendor,
            reorderLevel: processedProduct.reorderLevel,
            stockStatus: stockStatus,
            branchId: 'mombasa', // Default to Mombasa branch
          },
        })

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            branchId: 'mombasa',
            movementType: 'adjustment',
            quantity: processedProduct.balance,
            reference: `IMPORT-${batchId}`,
            notes: `${processor.categoryName} inventory import`,
          },
        })

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId,
            action: 'IMPORT_INVENTORY',
            entityType: 'Product',
            entityId: product.id,
            details: `Mombasa ${processor.categoryName}: ${processedProduct.name} - ${processedProduct.balance} units`,
          },
        })

        results.processed++

      } catch (error) {
        console.error('Error processing row:', row, error)
        results.errors++
      }
    }
  })

  await prisma.$disconnect()

  return results
}