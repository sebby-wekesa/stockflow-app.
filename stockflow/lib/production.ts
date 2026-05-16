import type { JobCardStatus, ProductCategory } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION STAGES
// Defined here because they're business logic, not database structure.
// Each stage has a number (sequence), a key (machine name), and a label.
// ─────────────────────────────────────────────────────────────────────────────

export type StageDefinition = {
  number: number
  key: string
  label: string
  description: string
}

export const SPRING_STAGES: StageDefinition[] = [
  { number: 1, key: 'shearing', label: 'Shearing', description: 'Cut flat bar to length' },
  { number: 2, key: 'eye_rolling', label: 'Eye rolling', description: 'Form eye at each end of leaf' },
  { number: 3, key: 'taper_rolling', label: 'Taper rolling', description: 'Taper the leaf ends' },
  { number: 4, key: 'drilling', label: 'Drilling', description: 'Centre hole for bolt' },
  { number: 5, key: 'hardening', label: 'Hardening', description: 'Heat treat for strength' },
  { number: 6, key: 'tempering', label: 'Tempering', description: 'Reduce brittleness after hardening' },
  { number: 7, key: 'hardness_testing', label: 'Hardness testing', description: 'QC: Rockwell hardness check' },
  { number: 8, key: 'cambering', label: 'Cambering', description: 'Form the curve' },
  { number: 9, key: 'painting', label: 'Painting', description: 'Apply protective paint coat' },
  { number: 10, key: 'finishing', label: 'Finishing & QC', description: 'Final inspection and packaging prep' },
]

export const UBOLT_STAGES: StageDefinition[] = [
  { number: 1, key: 'cutting', label: 'Cutting', description: 'Cut round bar to length' },
  { number: 2, key: 'chamfering', label: 'Chamfering', description: 'Bevel the ends' },
  { number: 3, key: 'turning', label: 'Turning', description: 'Lathe operation' },
  { number: 4, key: 'threading', label: 'Threading', description: 'Cut threads on each end' },
  { number: 5, key: 'forging', label: 'Forging', description: 'Heat and shape centre' },
  { number: 6, key: 'bending', label: 'Bending', description: 'Form U shape' },
  { number: 7, key: 'painting', label: 'Painting', description: 'Apply protective paint coat' },
  { number: 8, key: 'finishing', label: 'Finishing & QC', description: 'Final inspection' },
]

export function getStagesForCategory(category: ProductCategory): StageDefinition[] {
  if (category === 'manufactured_spring') return SPRING_STAGES
  if (category === 'manufactured_ubolt') return UBOLT_STAGES
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS LABELS
// ─────────────────────────────────────────────────────────────────────────────

export const JOB_STATUS_LABELS: Record<JobCardStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
}

export const JOB_STATUS_BADGE_CLASS: Record<JobCardStatus, string> = {
  open: 'bg-surface2 text-muted',
  in_progress: 'bg-purple/15 text-purple',
  complete: 'bg-teal/15 text-teal',
  cancelled: 'bg-red/15 text-red',
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

export function formatKg(kg: number): string {
  return `${kg.toLocaleString('en-KE', { maximumFractionDigits: 2 })} kg`
}