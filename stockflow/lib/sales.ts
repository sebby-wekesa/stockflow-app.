import { getTenantPrisma } from '@/lib/tenant-prisma'
import type { Prisma } from '@prisma/client'
export { STATUS_LABELS, STATUS_BADGE_CLASS, formatKES } from './sales-utils'

// Springtech's invoice prefix convention. Other orgs will get the default
// '' prefix until we add a tenant-level "branch prefix" config.
const SPRINGTECH_INVOICE_PREFIX: Record<string, string> = {
  mombasa: '',
  nairobi: 'NBI',
  bunje: 'BNJ',
}

/**
 * Generate the next invoice number for a given org+branch.
 *
 * Scans recent SaleOrder rows in THIS org whose id starts with the branch
 * prefix, finds the highest numeric portion, returns prefix + (max + 1).
 * Falls back to a sensible starting point if no prior invoices exist.
 *
 * Notes for multitenancy:
 *   - Org-scoped via getTenantPrisma()
 *   - Different orgs can use the same prefixes (composite uniqueness in DB)
 *   - For non-Springtech orgs, prefix defaults to '' (numeric only).
 *     Stage 6 will add a tenant settings UI to configure prefixes.
 */
export async function nextInvoiceNumber(
  organizationId: string,
  branch: string,
  txClient?: Prisma.TransactionClient
): Promise<string> {
  const db = (txClient as any) || getTenantPrisma(organizationId)
  const prefix = SPRINGTECH_INVOICE_PREFIX[branch.toLowerCase()] ?? ''

  const existing = await db.saleOrder.findMany({
    where: prefix
      ? { id: { startsWith: prefix } }
      : { NOT: { id: { startsWith: 'NBI' } } },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  let maxNum = 0
  for (const e of existing) {
    if (!e.id) continue
    // For Mombasa, skip rows that belong to other branches
    if (!prefix) {
      if (e.id.startsWith('NBI') || e.id.startsWith('BNJ') || e.id.startsWith('DRAFT')) {
        continue
      }
    }
    const numPart = prefix ? e.id.replace(prefix, '') : e.id
    const parsed = parseInt(numPart.replace(/\D/g, ''), 10)
    if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed
  }

  const next = maxNum > 0 ? maxNum + 1 : branch.toLowerCase() === 'mombasa' ? 100000 : 1
  return `${prefix}${next}`
}
