import type { BranchEnum, SaleStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT: 'Draft',
  INVOICED: 'Invoiced',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
}

export const STATUS_BADGE_CLASS: Record<SaleStatus, string> = {
  DRAFT: 'bg-surface2 text-muted',
  INVOICED: 'bg-accent/15 text-accent',
  FULFILLED: 'bg-teal/15 text-teal',
  CANCELLED: 'bg-red/15 text-red',
}

// Branch invoice prefixes — matches existing Springtech numbering convention
const INVOICE_PREFIX: Record<BranchEnum, string> = {
  mombasa: '',        // Mombasa uses pure numeric: 107372
  nairobi: 'NBI',     // NBI25228
  bonje: 'BNJ',       // BNJ633
}

/**
 * Generate the next invoice number for a branch. Reads the highest existing
 * number with that prefix and increments. Falls back to 1000 (Mombasa) or
 * 1 (branches) if none exists.
 */
export async function nextInvoiceNumber(branch: BranchEnum): Promise<string> {
  const prefix = INVOICE_PREFIX[branch]

  const existing = await prisma.saleOrder.findMany({
    where: branch === 'mombasa'
      ? { branch }                                      // mombasa: any number
      : { orderNumber: { startsWith: prefix } },       // others: must have prefix
    select: { orderNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 200, // scan recent invoices to find the max
  })

  let maxNum = 0
  for (const e of existing) {
    const numPart = prefix
      ? e.orderNumber!.replace(prefix, '')
      : e.orderNumber!
    const parsed = parseInt(numPart.replace(/\D/g, ''), 10)
    if (!isNaN(parsed) && parsed > maxNum) maxNum = parsed
  }

  const next = maxNum > 0 ? maxNum + 1 : (branch === 'mombasa' ? 100000 : 1)
  return `${prefix}${next}`
}

export function formatKES(amount: number): string {
  return amount.toLocaleString('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}