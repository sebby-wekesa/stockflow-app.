/**
 * Branch helpers. Branches are stored as Branch model rows in the database
 * (each with a UUID `id` and a string `code`). For UI/import purposes we use
 * a string code like 'mombasa' / 'nairobi' / 'bonje'.
 */

export type BranchCode = 'mombasa' | 'nairobi' | 'bonje'

export const BRANCH_LABELS: Record<BranchCode, string> = {
  mombasa: 'Mombasa HQ',
  nairobi: 'Nairobi',
  bonje: 'Bonje',
}

export const BRANCH_SUB: Record<BranchCode, string> = {
  mombasa: 'Production + main store',
  nairobi: 'Retail branch',
  bonje: 'Retail branch',
}

// Border accent colors per branch (Tailwind classes)
export const BRANCH_ACCENT_CLASS: Record<BranchCode, string> = {
  mombasa: 'before:bg-accent',
  nairobi: 'before:bg-teal',
  bonje: 'before:bg-purple',
}

export const BRANCH_TEXT_CLASS: Record<BranchCode, string> = {
  mombasa: 'text-accent',
  nairobi: 'text-teal',
  bonje: 'text-purple',
}

export const ALL_BRANCHES: BranchCode[] = ['mombasa', 'nairobi', 'bonje']

// KES formatter — used everywhere stock value is shown
export function formatKES(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return amount.toLocaleString('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
