/**
 * Product-name alias matcher.
 *
 * Tenant-aware: cache is keyed by organizationId so different tenants
 * don't see each other's aliases.
 */

import { getTenantPrisma } from '@/lib/tenant-prisma'

type MatchResult = { product: { id: string; sku: string | null; name: string }; confidence: number }
type OrgCache = Map<string, MatchResult>

// Normalise a product name for alias matching
export function normaliseForMatching(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize spaces
}

// Cache: orgId -> normalised-name -> match
const cache = new Map<string, OrgCache>()

export function clearAliasCache(organizationId?: string) {
  if (organizationId) {
    cache.delete(organizationId)
  } else {
    cache.clear()
  }
}

/**
 * Find the Product that best matches a raw name within an organization.
 * Returns null if no alias or canonical-name match is found.
 */
export async function matchProductName(
  rawName: string,
  organizationId: string
): Promise<MatchResult | null> {
  if (!cache.has(organizationId)) {
    const orgCache: OrgCache = new Map()
    const db = getTenantPrisma(organizationId)

    // Load all products + their aliases for this org
    const products = await db.product.findMany({
      select: { id: true, sku: true, name: true },
    })
    const aliases = await db.productAlias.findMany({
      select: { product_id: true, alias: true },
    })

    // Project to the narrow MatchResult.product shape (sku can be null in
    // some product origins, so the type widens here intentionally).
    const slimProducts = products.map((p) => ({
      id: p.id,
      sku: (p.sku ?? null) as string | null,
      name: p.name,
    }))
    const productMap = new Map(slimProducts.map((p) => [p.id, p]))

    // Index canonical names
    for (const product of slimProducts) {
      const canonicalKey = normaliseForMatching(product.name)
      orgCache.set(canonicalKey, { product, confidence: 1.0 })
    }

    // Index aliases
    for (const alias of aliases) {
      const product = productMap.get(alias.product_id)
      if (!product) continue
      const aliasKey = normaliseForMatching(alias.alias)
      // Don't overwrite a canonical match with an alias one
      if (!orgCache.has(aliasKey)) {
        orgCache.set(aliasKey, { product, confidence: 0.9 })
      }
    }

    cache.set(organizationId, orgCache)
  }

  const orgCache = cache.get(organizationId)!
  const normalised = normaliseForMatching(rawName)
  return orgCache.get(normalised) || null
}
