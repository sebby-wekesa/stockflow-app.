import * as XLSX from 'xlsx'

// ─────────────────────────────────────────────────────────────────────────────
// SHEET TYPES — what kind of data is in this file
// ─────────────────────────────────────────────────────────────────────────────

export type SheetType =
  | 'sales_quickbooks'    // QuickBooks sales export (Type/Date/Num/Memo/Name/Class/Qty/Price)
  | 'springs_stock'       // STOCKED ITEM LIST sheet from springs file
  | 'rm_flatbar'          // Flat bar raw material sheet
  | 'rm_roundbar'         // Round bar raw material sheet
  | 'consumables'         // Mombasa/Nairobi consumable stock sheets
  | 'inventory'           // Mombasa inventory sheets (BRAKE LININGS, CENTRE BOLTS, etc.)
  | 'stock_movement'      // Stock in/out movement sheets
  | 'sales'               // Sales data sheets

export const SHEET_TYPE_LABELS: Record<SheetType, string> = {
  sales_quickbooks: 'Sales export (QuickBooks)',
  springs_stock: 'Springs stock sheet',
  rm_flatbar: 'Raw material — flat bars',
  rm_roundbar: 'Raw material — round bars',
  consumables: 'Consumables stock',
  inventory: 'Mombasa inventory sheets',
  stock_movement: 'Stock movement sheets',
  sales: 'Sales data sheets',
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD DEFINITIONS — what columns each sheet type expects to have
// ─────────────────────────────────────────────────────────────────────────────

// Canonical fields the import flow can map into
export type ImportField =
  | 'movement_date'
  | 'order_number'
  | 'raw_product_name'
  | 'customer_name'
  | 'supplier_name'
  | 'branch'
  | 'qty'
  | 'unit_price'
  | 'unit_cost'
  | 'notes'
  | 'ignore'

export const FIELD_LABELS: Record<ImportField, string> = {
  movement_date: 'Movement date',
  order_number: 'Order / invoice number',
  raw_product_name: 'Product name (raw)',
  customer_name: 'Customer name',
  supplier_name: 'Supplier name',
  branch: 'Branch (mombasa / nairobi / bonje)',
  qty: 'Quantity',
  unit_price: 'Unit price',
  unit_cost: 'Unit cost',
  notes: 'Notes / memo',
  ignore: '(ignore this column)',
}

// Required fields by sheet type — the import won't proceed without these
export const REQUIRED_FIELDS: Record<SheetType, ImportField[]> = {
  sales_quickbooks: ['movement_date', 'raw_product_name', 'qty'],
  springs_stock: ['raw_product_name', 'qty'],
  rm_flatbar: ['raw_product_name', 'qty'],
  rm_roundbar: ['raw_product_name', 'qty'],
  consumables: ['raw_product_name', 'qty'],
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-MAPPING — guesses based on column header names
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_ALIASES: Record<ImportField, string[]> = {
  movement_date: ['date', 'invoice date', 'transaction date'],
  order_number: ['num', 'number', 'invoice', 'invoice number', 'order number', 'doc num'],
  raw_product_name: [
    'memo', 'product', 'product description', 'description', 'item',
    'item name', 'product name',
  ],
  customer_name: ['name', 'customer', 'customer name', 'client'],
  supplier_name: ['supplier', 'supplier name', 'vendor'],
  branch: ['class', 'branch', 'location', 'store'],
  qty: ['qty', 'quantity', 'units', 'pcs'],
  unit_price: ['price', 'sales price', 'unit price', 'rate'],
  unit_cost: ['cost', 'unit cost', 'cost price'],
  notes: ['notes', 'remarks', 'comments'],
  ignore: [],
}

export function suggestMapping(
  headers: string[],
  _sheetType: SheetType
): Record<string, ImportField> {
  const mapping: Record<string, ImportField> = {}

  for (const header of headers) {
    if (!header) continue
    const normalised = header.trim().toLowerCase()
    let matched: ImportField = 'ignore'

    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      ImportField,
      string[]
    ][]) {
      if (aliases.some((a) => normalised === a || normalised.includes(a))) {
        matched = field
        break
      }
    }

    mapping[header] = matched
  }

  return mapping
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING — reads an uploaded file into structured rows
// ─────────────────────────────────────────────────────────────────────────────

export type ParsedFile = {
  sheetNames: string[]
  rows: Record<string, unknown>[]   // each row keyed by header name
  headers: string[]
  totalRows: number
}

export async function parseExcelFile(file: File, sheetName?: string): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const sheetNames = workbook.SheetNames
  const targetSheet = sheetName ?? sheetNames[0]
  const worksheet = workbook.Sheets[targetSheet]

  if (!worksheet) {
    throw new Error(`Sheet "${targetSheet}" not found in file`)
  }

  // Convert to JSON keyed by header row
  // defval: '' ensures missing cells become empty strings rather than undefined
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false, // keep formatted strings (especially for dates)
  })

  // Extract unique headers from first row
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []

  return {
    sheetNames,
    rows,
    headers,
    totalRows: rows.length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEET TYPE DETECTION — scan headers to guess what kind of file this is
// ─────────────────────────────────────────────────────────────────────────────

export function detectSheetType(headers: string[]): SheetType | null {
  const lower = headers.map((h) => (h ?? '').toLowerCase())

  const hasDate = lower.some((h) => h.includes('date'))
  const hasMemo = lower.some((h) => h === 'memo' || h.includes('description'))
  const hasClass = lower.some((h) => h === 'class' || h.includes('branch'))
  const hasNum = lower.some((h) => h === 'num')
  const hasSalesPrice = lower.some((h) => h.includes('sales price'))

  if (hasDate && hasMemo && hasClass && (hasNum || hasSalesPrice)) {
    return 'sales_quickbooks'
  }

  // Round/flat bar detection
  const hasMaterialCode = lower.some((h) => /^[a-z]\d+x\d+/.test(h))
  if (hasMaterialCode) {
    if (lower.some((h) => h.startsWith('q'))) return 'rm_roundbar'
    return 'rm_flatbar'
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// VALUE EXTRACTION — converts raw cell value to canonical format
// ─────────────────────────────────────────────────────────────────────────────

export function extractDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const str = String(value).trim()
  if (!str) return null
  const parsed = new Date(str)
  if (isNaN(parsed.getTime())) return null
  return parsed
}

export function extractNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const cleaned = String(value).replace(/[,\s]/g, '')
  const num = Number(cleaned)
  return isNaN(num) ? null : num
}

export function extractString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str === '' ? null : str
}

// Branch normalisation — handles "Mombasa", "MOMBASA", "Mombasa HQ", etc.
export function extractBranch(value: unknown): 'mombasa' | 'nairobi' | 'bonje' | null {
  const str = extractString(value)
  if (!str) return null
  const lower = str.toLowerCase()
  if (lower.includes('mombasa')) return 'mombasa'
  if (lower.includes('nairobi')) return 'nairobi'
  if (lower.includes('bonje')) return 'bonje'
  return null
}