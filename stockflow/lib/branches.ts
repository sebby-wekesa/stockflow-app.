/**
 * Branch helpers. Branches are stored as Branch model rows in the database
 * (each with a UUID `id` and a string `code`). For UI/import purposes we use
 * a string code like 'mombasa' / 'nairobi' / 'bunje'.
 */

export type BranchCode = 'mombasa' | 'nairobi' | 'bunje'

export const BRANCH_LABELS: Record<BranchCode, string> = {
  mombasa: 'Mombasa HQ',
  nairobi: 'Nairobi',
  bunje: 'Bunje',
}

export const BRANCH_SUB: Record<BranchCode, string> = {
  mombasa: 'Production + main store',
  nairobi: 'Retail branch',
  bunje: 'Retail branch',
}

// Border accent colors per branch (Tailwind classes)
export const BRANCH_ACCENT_CLASS: Record<BranchCode, string> = {
  mombasa: 'before:bg-accent',
  nairobi: 'before:bg-teal',
  bunje: 'before:bg-purple',
}

export const BRANCH_TEXT_CLASS: Record<BranchCode, string> = {
  mombasa: 'text-accent',
  nairobi: 'text-teal',
  bunje: 'text-purple',
}

export const ALL_BRANCHES: BranchCode[] = ['mombasa', 'nairobi', 'bunje']

export function normalizeBranchCode(...values: Array<string | null | undefined>): BranchCode | null {
  const normalized = values.filter(Boolean).join(' ').toLowerCase()

  if (normalized.includes('mombasa') || /\bmsa\b/.test(normalized)) return 'mombasa'
  if (normalized.includes('nairobi') || /\b(nbo|nbi)\b/.test(normalized)) return 'nairobi'
  if (normalized.includes('bunje') || normalized.includes('bonje') || /\bbnj\b/.test(normalized)) {
    return 'bunje'
  }

  return null
}

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
