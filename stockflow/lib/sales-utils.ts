import type { BranchCode as Branch } from '@/lib/branches'
import type { SaleStatus as SalesOrderStatus } from '@prisma/client'

export const STATUS_LABELS: Record<SalesOrderStatus, string> = {
  PENDING: 'Draft',
  CONFIRMED: 'Confirmed',
  READY_FOR_DISPATCH: 'Ready for dispatch',
  SHIPPED: 'Shipped',
  CANCELLED: 'Cancelled',
}

export const STATUS_BADGE_CLASS: Record<SalesOrderStatus, string> = {
  PENDING: 'bg-surface2 text-muted',
  CONFIRMED: 'bg-purple/15 text-purple',
  READY_FOR_DISPATCH: 'bg-amber/15 text-amber',
  SHIPPED: 'bg-teal/15 text-teal',
  CANCELLED: 'bg-red/15 text-red',
}

export function formatKES(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return amount.toLocaleString('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
