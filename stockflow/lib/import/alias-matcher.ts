// Normalise a product name for alias matching
export function normaliseForMatching(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
}

// Cache for alias matching to improve performance
let aliasCache: Map<string, { product: any; confidence: number } | null> | null = null

export function clearAliasCache() {
  aliasCache = null
}

export async function matchProductName(rawName: string): Promise<{ product: any; confidence: number } | null> {
  const { prisma } = await import('@/lib/prisma')

  if (aliasCache === null) {
    // Build cache of all products and aliases
    aliasCache = new Map()

    const products = await prisma.product.findMany({
      include: { aliases: true },
    })

    for (const product of products) {
      // Add canonical name
      const canonicalKey = normaliseForMatching(product.name)
      aliasCache.set(canonicalKey, { product, confidence: 1.0 })

      // Add aliases
      for (const alias of product.aliases) {
        const aliasKey = normaliseForMatching(alias.alias)
        aliasCache.set(aliasKey, { product, confidence: 0.9 })
      }
    }
  }

  const normalised = normaliseForMatching(rawName)
  return aliasCache.get(normalised) || null
}