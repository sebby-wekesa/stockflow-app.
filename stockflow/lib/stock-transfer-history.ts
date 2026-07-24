import type { Prisma } from '@prisma/client'
import type { UserRole } from '@/lib/types'

/**
 * Limits transfer history to the branches a user is allowed to observe.
 *
 * A branch is involved in a transfer from either side of the handoff, so a
 * branch user must match both source and destination relationships. The
 * caller still supplies a tenant-scoped Prisma client for the organization
 * boundary; this helper only defines the branch visibility portion.
 */
export function getStockTransferHistoryVisibilityWhere(
  role: UserRole,
  branchIds: string[],
): Prisma.StockTransferWhereInput {
  if (role === 'ADMIN' || role === 'MANAGER') {
    return {}
  }

  // An empty list must remain restrictive. Returning an explicit impossible
  // id filter avoids accidentally exposing organization-wide history when a
  // user has not been assigned a branch.
  if (branchIds.length === 0) {
    return { id: { in: [] } }
  }

  return {
    OR: [
      { sourceBranchId: { in: branchIds } },
      { destinationBranchId: { in: branchIds } },
    ],
  }
}
