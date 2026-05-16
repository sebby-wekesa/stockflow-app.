import type { BranchCode as Branch } from '@/lib/branches'
import { prisma } from '@/lib/prisma'
export { STATUS_LABELS, STATUS_BADGE_CLASS, formatKES } from './sales-utils'

// Branch invoice prefixes — matches existing Springtech numbering convention
const INVOICE_PREFIX: Record<Branch, string> = {
  mombasa: '',    // Mombasa uses pure numeric: 107372
  nairobi: 'NBI', // NBI25228
  bonje: 'BNJ',   // BNJ633
}

/**
 * Generate the next invoice number for a branch.
 *
 * Scans recent SaleOrder rows whose id starts with the branch prefix (or
 * any numeric id for Mombasa), finds the highest numeric portion, and
 * returns prefix + (max + 1). Falls back to 100000 (Mombasa) or 1 (branches)
 * if no prior invoices exist.
 *
 * Note: SaleOrder.id is the invoice number in this schema. There's no
 * separate order_number column.
 */
export async function nextInvoiceNumber(branch: Branch): Promise<string> {
  const prefix = INVOICE_PREFIX[branch]

  const existing = await prisma.saleOrder.findMany({
    where: prefix
      ? { id: { startsWith: prefix } }
      : { id: { not: { startsWith: 'NBI' } } }, // Mombasa: any id that isn't a branch one
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  let maxNum = 0
  for (const e of existing) {
    if (!e.id) continue
    // Skip drafts and other branch prefixes for mombasa
    if (!prefix && (e.id.startsWith('NBI') || e.id.startsWith('BNJ') || e.id.startsWith('DRAFT'))) {
      continue
    }
    const numPart = prefix ? e.id.replace(prefix, '') : e.id
    const parsed = parseInt(numPart.replace(/\D/g, ''), 10)
    if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed
  }

  const next = maxNum > 0 ? maxNum + 1 : branch === 'mombasa' ? 100000 : 1
  return `${prefix}${next}`
}
