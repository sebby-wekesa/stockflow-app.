export const QUICK_IMPORT_SHEET_TYPES = [
  'sales_quickbooks_v2',
  'sales_simple',
  'springs_master',
  'ubolt_master',
  'consumables_stock',
] as const

export type QuickImportSheetType = (typeof QUICK_IMPORT_SHEET_TYPES)[number]

export const QUICK_IMPORT_SHEET_TYPE_LABELS: Record<QuickImportSheetType, string> = {
  sales_quickbooks_v2: 'QuickBooks sales export',
  sales_simple: 'Simple sales list',
  springs_master: 'Springs master list',
  ubolt_master: 'U-bolt master list',
  consumables_stock: 'Branch consumables stock',
}

export function isQuickImportSheetType(sheetType: string): sheetType is QuickImportSheetType {
  return QUICK_IMPORT_SHEET_TYPES.includes(sheetType as QuickImportSheetType)
}

export function getImportBatchHref(batch: { id: string; sheet_type: string }) {
  return isQuickImportSheetType(batch.sheet_type)
    ? `/import/specialized/${batch.id}`
    : `/import/${batch.id}`
}

export function getSheetTypeLabel(sheetType: string) {
  return isQuickImportSheetType(sheetType)
    ? QUICK_IMPORT_SHEET_TYPE_LABELS[sheetType]
    : sheetType
}
