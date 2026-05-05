import { prisma } from '@/lib/prisma'

export type ResolutionAction =
  | { type: 'create_product'; category: string; product_code: string; canonical_name: string }
  | { type: 'use_existing'; product_id: string }
  | { type: 'create_alias'; product_id: string; alias_name: string }

// Resolves a single import row conflict
export async function resolveConflict(importRowId: string, resolution: ResolutionAction) {
  throw new Error('Legacy import conflict resolution is unavailable on the current schema')
}

// Commits the entire import batch to stock_movements and sales_orders
export async function commitImport(batchId: string, userId: string) {
  throw new Error('Legacy import commit flow is unavailable on the current schema')
}