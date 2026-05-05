import type { BranchEnum } from '@prisma/client'

export const BRANCH_LABELS: Record<BranchEnum, string> = {
  mombasa: 'Mombasa HQ',
  nairobi: 'Nairobi',
  bonje: 'Bonje',
}

export const BRANCH_SUB: Record<BranchEnum, string> = {
  mombasa: 'Production + main store',
  nairobi: 'Retail branch',
  bonje: 'Retail branch',
}

// Border accent colors per branch — these are 3px top borders on cards
export const BRANCH_ACCENT_CLASS: Record<BranchEnum, string> = {
  mombasa: 'before:bg-accent',
  nairobi: 'before:bg-teal',
  bonje: 'before:bg-purple',
}

export const BRANCH_TEXT_CLASS: Record<BranchEnum, string> = {
  mombasa: 'text-accent',
  nairobi: 'text-teal',
  bonje: 'text-purple',
}

export const ALL_BRANCHES: BranchEnum[] = ['mombasa', 'nairobi', 'bonje']

// KES formatter — used everywhere stock value is shown
export function formatKES(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `KES ${(amount / 1_000).toFixed(0)}K`
  return `KES ${amount.toFixed(0)}`
}