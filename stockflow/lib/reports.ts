// ─────────────────────────────────────────────────────────────────────────────
// DATE RANGES — used across all reports for consistent period filtering
// ─────────────────────────────────────────────────────────────────────────────

export type DateRangeKey = '7d' | '30d' | '90d' | 'mtd' | 'qtd' | 'ytd' | 'all'

export const RANGE_LABELS: Record<DateRangeKey, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  mtd: 'Month to date',
  qtd: 'Quarter to date',
  ytd: 'Year to date',
  all: 'All time',
}

/**
 * Returns a [start, end] tuple for the given range key. End is always 'now'.
 * 'all' returns null for start.
 */
export function getDateRange(key: DateRangeKey): { start: Date | null; end: Date } {
  const now = new Date()
  const end = now
  if (key === 'all') return { start: null, end }

  const start = new Date(now)
  if (key === '7d') start.setDate(now.getDate() - 7)
  else if (key === '30d') start.setDate(now.getDate() - 30)
  else if (key === '90d') start.setDate(now.getDate() - 90)
  else if (key === 'mtd') start.setDate(1)
  else if (key === 'qtd') {
    const month = now.getMonth()
    start.setMonth(Math.floor(month / 3) * 3, 1)
  } else if (key === 'ytd') start.setMonth(0, 1)

  start.setHours(0, 0, 0, 0)
  return { start, end }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV BUILDER — converts an array of objects to a CSV string
// ─────────────────────────────────────────────────────────────────────────────

export function toCSV(
  rows: Record<string, unknown>[],
  columns?: { key: string; label: string }[]
): string {
  if (rows.length === 0) return ''

  // If columns aren't specified, use keys from first row
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }))

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const str = val instanceof Date ? val.toISOString() : String(val)
    // CSV escape: wrap in quotes if contains comma, quote, or newline
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const header = cols.map((c) => escape(c.label)).join(',')
  const body = rows
    .map((row) => cols.map((c) => escape(row[c.key])).join(','))
    .join('\n')

  return `${header}\n${body}`
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTH-OVER-MONTH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function formatPctChange(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}