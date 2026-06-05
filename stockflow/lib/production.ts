export type StageDefinition = {
  number: number
  key: string
  label: string
  description: string
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

export function formatKg(kg: number): string {
  return `${kg.toLocaleString('en-KE', { maximumFractionDigits: 2 })} kg`
}
