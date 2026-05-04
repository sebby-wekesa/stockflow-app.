import { prisma } from '@/lib/prisma'

// Normalise text for alias matching — remove punctuation, lowercase, etc.
export function normaliseForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ') // normalise whitespace
    .trim()
}

// Matches raw product names in import rows to canonical products using aliases
export async function matchImportBatch(batchId: string) {
  const rows = await prisma.importRow.findMany({
    where: { import_batch_id: batchId, raw_product_name: { not: null } },
    select: { id: true, raw_product_name: true },
  })

  for (const row of rows) {
    if (!row.raw_product_name) continue

    // First try exact match on product aliases
    let matchedProduct = await prisma.productAlias.findFirst({
      where: { alias_name: { equals: row.raw_product_name, mode: 'insensitive' } },
      include: { product: true },
    })?.product

    // If no alias match, try direct match on product canonical name
    if (!matchedProduct) {
      matchedProduct = await prisma.product.findFirst({
        where: { canonical_name: { equals: row.raw_product_name, mode: 'insensitive' } },
      })
    }

    // Update the row with matched product
    await prisma.importRow.update({
      where: { id: row.id },
      data: {
        matched_product_id: matchedProduct?.id ?? null,
        status: matchedProduct ? 'matched' : 'unmatched',
      },
    })
  }
}