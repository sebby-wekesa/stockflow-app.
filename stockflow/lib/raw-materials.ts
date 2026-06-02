export const RAW_MATERIAL_CATEGORIES = ['Flat Bars', 'Round Bars', 'Spring Bushes'] as const

export type RawMaterialCategory = (typeof RAW_MATERIAL_CATEGORIES)[number]

export function normalizeRawMaterialCategory(value: unknown): RawMaterialCategory {
  return RAW_MATERIAL_CATEGORIES.includes(value as RawMaterialCategory)
    ? value as RawMaterialCategory
    : 'Flat Bars'
}
