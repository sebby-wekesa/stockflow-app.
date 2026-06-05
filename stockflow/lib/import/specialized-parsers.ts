/**
 * Specialized parsers for the actual Excel formats Springtech uses.
 *
 * These files have non-standard layouts that the generic `sheet_to_json`
 * approach can't handle:
 *
 *   - QuickBooks sales export has headers in scattered columns with
 *     interleaved product-group headers and "Total" subtotal rows
 *   - Springs master list has vehicle-make group rows followed by
 *     product rows with code in column 2
 *   - U-bolt list has headers in row 2 not row 1
 *   - Stock files have three side-by-side tables (in / out / balance)
 *     starting at row 5
 *
 * Each parser knows its format and produces a clean normalized array
 * of rows ready for matching + commit.
 */

import * as XLSX from 'xlsx'

/** Branch codes — matches the strings used elsewhere in the app */
export type BranchCode = 'mombasa' | 'nairobi' | 'bunje'

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZED OUTPUT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** A row destined for the SalesOrder + SalesOrderLine + sales_out flow */
export type ParsedSalesRow = {
  source_row: number
  movement_date: Date | null
  order_number: string | null
  raw_product_name: string | null
  customer_name: string | null
  branch: BranchCode | null
  qty: number | null
  unit_price: number | null
  amount: number | null
  notes: string | null
}

/** A row destined for the Product master (springs / U-bolts) */
export type ParsedProductRow = {
  source_row: number
  product_code: string | null
  canonical_name: string
  category: 'springs' | 'ubolts' | 'trailer_parts' | 'break_linings' | 'center_bolts'
  product_type: string
  uom: 'pcs' | 'set'
  vehicle_make: string | null
  vehicle_model: string | null
  spring_position: string | null
  leaf_position: string | null
  cost_price: number | null
  selling_price: number | null
}

/** A row destined for stock import (opening balance or movement) */
export type ParsedStockRow = {
  source_row: number
  movement_date: Date | null
  raw_product_name: string | null
  branch: BranchCode
  qty: number | null
  direction: 'in' | 'out' | 'balance'
  reference: string | null
  notes: string | null
}

export type ConsumablesWorkbookParseResult = {
  rows: ParsedStockRow[]
  candidateSheetNames: string[]
  parsedSheets: Array<{ sheetName: string; rowCount: number }>
  errors: Array<{ sheetName: string; error: string }>
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEET TYPE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export type SpecializedSheetType =
  | 'sales_quickbooks_v2'
  | 'sales_simple'
  | 'springs_master'
  | 'ubolt_master'
  | 'consumables_stock'

export type DetectResult = {
  recommendedSheetType: SpecializedSheetType | 'unknown'
  sheetNames: string[]
  reason: string
}

export function detectFile(file: File): Promise<DetectResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
        const sheetNames = wb.SheetNames

        // Check for QuickBooks sales export (flexible — any column)
        if (sheetNames.length === 1) {
          const ws = wb.Sheets[sheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
          const hasInvoiceType = rows.some((row) =>
            row.some((cell) => toStr(cell) === 'Invoice')
          )
          if (hasInvoiceType) {
            return resolve({
              recommendedSheetType: 'sales_quickbooks_v2',
              sheetNames,
              reason: 'Found "Invoice" rows — looks like QuickBooks sales export',
            })
          }
        }

        // Check for simple sales ledger (product, quantity, invoice_number, customer, location, date)
        {
          const ws = wb.Sheets[sheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
          const hasSimpleSalesHeaders = rows.some((row) => {
            const norm = row.map((c) => toStr(c)?.toLowerCase() ?? '')
            return norm.includes('product') && norm.includes('quantity') && norm.includes('invoice_number')
          })
          if (hasSimpleSalesHeaders) {
            return resolve({
              recommendedSheetType: 'sales_simple',
              sheetNames,
              reason: 'Found columns "product", "quantity", "invoice_number" — looks like simple sales list',
            })
          }
        }

        // Check for springs master
        if (sheetNames.includes('SPRINGS LIST')) {
          return resolve({
            recommendedSheetType: 'springs_master',
            sheetNames,
            reason: 'Found "SPRINGS LIST" sheet',
          })
        }

        // Check for U-bolt master
        if (sheetNames.includes('U BOLT LIST')) {
          return resolve({
            recommendedSheetType: 'ubolt_master',
            sheetNames,
            reason: 'Found "U BOLT LIST" sheet',
          })
        }

        // Check for consumables stock sheets.
        const inOutSheets = sheetNames.filter(isConsumablesStockSheetName)
        if (inOutSheets.length > 0) {
          return resolve({
            recommendedSheetType: 'consumables_stock',
            sheetNames,
            reason: `Found ${inOutSheets.length} sheets ending with "IN-OUT"`,
          })
        }

        return resolve({
          recommendedSheetType: 'unknown',
          sheetNames,
          reason: 'No recognizable patterns found',
        })
      } catch (err) {
        return resolve({
          recommendedSheetType: 'unknown',
          sheetNames: [],
          reason: `Parse error: ${(err as Error).message}`,
        })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getCell(row: unknown[], col: number): unknown {
  return col < row.length ? row[col] : undefined
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value
  // Handle Excel formulas that return numbers — these come through as strings starting with =
  const str = String(value).replace(/[,\s]/g, '')
  if (str.startsWith('=')) return null // formula not pre-evaluated
  const n = Number(str)
  return isNaN(n) ? null : n
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  // Excel sometimes gives serial numbers
  if (typeof value === 'number') {
    // Excel epoch is 1899-12-30 (with leap year bug)
    const epoch = new Date(1899, 11, 30)
    return new Date(epoch.getTime() + value * 86400000)
  }
  const str = String(value).trim()
  if (!str) return null
  const parsed = new Date(str)
  if (isNaN(parsed.getTime())) return null
  return parsed
}

function normaliseBranch(value: unknown): BranchCode | null {
  const str = toStr(value)
  if (!str) return null
  const lower = str.toLowerCase()
  if (lower.includes('mombasa')) return 'mombasa'
  if (lower.includes('nairobi')) return 'nairobi'
  if (lower.includes('bunje') || lower.includes('bonje')) return 'bunje'
  // Handle "Upcountry" as Mombasa
  if (lower.includes('upcountry')) return 'mombasa'
  return null
}

function readSheetAsRows(buffer: ArrayBuffer, sheetName?: string) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const targetSheet = sheetName ?? wb.SheetNames[0]
  const ws = wb.Sheets[targetSheet]
  if (!ws) throw new Error(`Sheet "${targetSheet}" not found`)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  return { rows, wb, ws }
}

function normalizeSheetName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function isConsumablesStockSheetName(sheetName: string): boolean {
  const normalized = normalizeSheetName(sheetName)
  return (
    normalized.includes('in out') ||
    normalized.includes('inout') ||
    normalized.includes('consumable') ||
    normalized.includes('stock')
  )
}

function isConsumablesHeaderRow(row: unknown[]): boolean {
  const cells = row.map((cell) => toStr(cell)?.toLowerCase() ?? '')
  const nonEmpty = cells.filter(Boolean)
  if (nonEmpty.length === 0) return true

  const hasProductHeader = cells.some((cell) =>
    ['product', 'item', 'description', 'particulars'].some((header) => cell.includes(header))
  )
  const hasQtyHeader = cells.some((cell) =>
    cell === 'qty' || cell === 'quantity' || cell.includes('qty') || cell.includes('quantity')
  )
  const hasMovementHeader = cells.some((cell) =>
    cell === 'in' ||
    cell === 'out' ||
    cell === 'stock in' ||
    cell === 'stock out' ||
    cell === 'balance' ||
    cell === 'bal'
  )

  return (hasProductHeader && (hasQtyHeader || hasMovementHeader)) || (hasQtyHeader && hasMovementHeader)
}

export function parseConsumablesWorkbook(
  buffer: ArrayBuffer,
  branch: BranchCode
): ConsumablesWorkbookParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  let candidateSheetNames = wb.SheetNames.filter(isConsumablesStockSheetName)

  if (candidateSheetNames.length === 0 && wb.SheetNames.length === 1) {
    candidateSheetNames = [...wb.SheetNames]
  }

  const rows: ParsedStockRow[] = []
  const parsedSheets: ConsumablesWorkbookParseResult['parsedSheets'] = []
  const errors: ConsumablesWorkbookParseResult['errors'] = []

  for (const sheetName of candidateSheetNames) {
    try {
      const parsed = parseConsumablesStock(buffer, sheetName, branch)
      parsedSheets.push({ sheetName, rowCount: parsed.length })
      rows.push(...parsed)
    } catch (err) {
      errors.push({ sheetName, error: (err as Error).message })
    }
  }

  if (rows.length === 0) {
    console.error('=== Consumables Stock Parser - 0 rows produced ===')
    console.error('Workbook sheets:', wb.SheetNames)
    console.error('Candidate sheets:', candidateSheetNames)
    console.error('Parsed sheets:', parsedSheets)
    console.error('Sheet parser errors:', errors)

    for (const sheetName of candidateSheetNames.slice(0, 5)) {
      const ws = wb.Sheets[sheetName]
      if (!ws) continue
      const sample = XLSX.utils
        .sheet_to_json(ws, { header: 1, defval: '' })
        .slice(0, 8)
      console.error(`Sample rows from "${sheetName}":`, sample)
    }
  }

  return { rows, candidateSheetNames, parsedSheets, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER 1 — QuickBooks sales export (robust column mapping)
//
// Supports both the original fixed layout and any QuickBooks export where the
// user included the standard columns (Type, Date, Num, Memo, Name, Class, Qty,
// Sales Price, Amount). We locate the header row and map columns by name so
// different column orders / extra columns do not break the import.
// ─────────────────────────────────────────────────────────────────────────────

interface QBColumnMap {
  type: number
  date: number
  num: number
  memo: number
  name: number
  class: number
  qty: number
  salesPrice: number
  amount: number
}

function findQuickBooksColumnMap(rows: unknown[][]): { map: QBColumnMap; headerRow: number } | null {
  // Scan first 15 rows — some QB exports have title + blank rows before the real table header
  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const row = rows[r]
    const normalized = row.map((c) => toStr(c)?.toLowerCase() ?? '')

    const map: Partial<QBColumnMap> = {}
    for (let c = 0; c < normalized.length; c++) {
      const cell = normalized[c]
      if (!cell) continue

      if (!map.type && (cell === 'type' || cell.includes('type'))) map.type = c
      if (!map.date && (cell === 'date' || cell === 'txn date')) map.date = c
      if (!map.num && (cell === 'num' || cell === 'number' || cell.includes('invoice') || cell === '#')) map.num = c
      if (!map.memo && (cell === 'memo' || cell === 'description' || cell.includes('item') || cell.includes('product') || cell.includes('desc'))) map.memo = c
      if (!map.name && (cell === 'name' || cell === 'customer' || cell.includes('customer'))) map.name = c
      if (!map.class && (cell === 'class' || cell === 'location' || cell === 'branch')) map.class = c
      if (!map.qty && (cell === 'qty' || cell === 'quantity' || cell.includes('qty') || cell.includes('quantity'))) map.qty = c
      if (!map.salesPrice && (cell.includes('sales price') || cell === 'rate' || cell === 'price' || cell.includes('unit price'))) map.salesPrice = c
      if (!map.amount && (cell === 'amount' || cell === 'total')) map.amount = c
    }

    // Minimum required: type column + a product/description column + qty column
    if (map.type !== undefined && map.memo !== undefined && map.qty !== undefined) {
      return {
        map: {
          type: map.type,
          date: map.date ?? 9,
          num: map.num ?? 11,
          memo: map.memo,
          name: map.name ?? 15,
          class: map.class ?? 17,
          qty: map.qty,
          salesPrice: map.salesPrice ?? 23,
          amount: map.amount ?? 25,
        },
        headerRow: r,
      }
    }
  }

  return null
}

export function parseSalesQuickbooks(buffer: ArrayBuffer): ParsedSalesRow[] {
  const { rows } = readSheetAsRows(buffer)
  const out: ParsedSalesRow[] = []

  const found = findQuickBooksColumnMap(rows)
  const colMap = found ? found.map : null
  const headerRow = found ? found.headerRow : -1

  // Fallback to the original hard-coded layout if we couldn't find a header
  const getIdx = (logical: keyof QBColumnMap) => (colMap ? colMap[logical] : getFallbackIndex(logical))

  function getFallbackIndex(logical: keyof QBColumnMap): number {
    switch (logical) {
      case 'type': return 7
      case 'date': return 9
      case 'num': return 11
      case 'memo': return 13
      case 'name': return 15
      case 'class': return 17
      case 'qty': return 19
      case 'salesPrice': return 23
      case 'amount': return 25
    }
  }

  // Start data from the row after the detected header (or row 1 for fallback)
  const startRow = headerRow >= 0 ? headerRow + 1 : 1

  // Accept common QuickBooks sales transaction types
  const isSaleType = (t: string | null) => {
    if (!t) return false
    const lower = t.toLowerCase().trim()
    return lower === 'invoice' || lower.includes('sales receipt') || lower === 'salesreceipt'
  }

  // Support two common QuickBooks layouts:
  // 1. Every line-item row has "Invoice" in the Type column (flattened)
  // 2. Type only appears on the invoice header row; subsequent rows with Qty + product have blank Type (grouped)
  type InvoiceContext = {
    movement_date: Date | null
    order_number: string | null
    customer_name: string | null
    branch: BranchCode | null
    branchNote: string | null
  }
  let currentContext: InvoiceContext | null = null

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    const typeCell = toStr(getCell(row, getIdx('type')))
    const qty = toNumber(getCell(row, getIdx('qty')))
    const memo = toStr(getCell(row, getIdx('memo')))

    const originalBranchLabel = toStr(getCell(row, getIdx('class')))
    const normalisedBranch = normaliseBranch(originalBranchLabel)
    const branchNote =
      originalBranchLabel && originalBranchLabel.toLowerCase().includes('upcountry')
        ? `Upcountry sale (assigned to Mombasa)`
        : null

    const rowDate = toDate(getCell(row, getIdx('date')))
    const rowNum = toStr(getCell(row, getIdx('num')))
    const rowCustomer = toStr(getCell(row, getIdx('name')))

    if (isSaleType(typeCell)) {
      // This row starts (or is) a sale transaction
      if (qty !== null && memo) {
        // Direct line item with full info on the same row (layout 1)
        out.push({
          source_row: i + 1,
          movement_date: rowDate,
          order_number: rowNum,
          raw_product_name: memo,
          customer_name: rowCustomer,
          branch: normalisedBranch,
          qty: Math.abs(Math.round(qty)),
          unit_price: toNumber(getCell(row, getIdx('salesPrice'))),
          amount: toNumber(getCell(row, getIdx('amount'))),
          notes: branchNote,
        })
        // Keep context updated in case next lines are blank-Type
        currentContext = {
          movement_date: rowDate,
          order_number: rowNum,
          customer_name: rowCustomer,
          branch: normalisedBranch,
          branchNote,
        }
      } else {
        // Header row for a new invoice — update context for following blank-Type lines
        currentContext = {
          movement_date: rowDate,
          order_number: rowNum,
          customer_name: rowCustomer,
          branch: normalisedBranch,
          branchNote,
        }
      }
      continue
    }

    // Not a sale-type row. If we have a context and this row has qty + product name, treat it as a line item belonging to the previous invoice.
    if (currentContext && qty !== null && memo) {
      out.push({
        source_row: i + 1,
        movement_date: currentContext.movement_date ?? rowDate,
        order_number: currentContext.order_number ?? rowNum,
        raw_product_name: memo,
        customer_name: currentContext.customer_name ?? rowCustomer,
        branch: currentContext.branch ?? normalisedBranch,
        qty: Math.abs(Math.round(qty)),
        unit_price: toNumber(getCell(row, getIdx('salesPrice'))),
        amount: toNumber(getCell(row, getIdx('amount'))),
        notes: currentContext.branchNote ?? branchNote,
      })
    }
  }

  if (out.length === 0) {
    console.error('=== QuickBooks Sales Parser — 0 rows produced ===')
    console.error('Total rows read from sheet:', rows.length)
    console.error('startRow (first data row):', startRow)
    console.error('Header row index found by detector:', headerRow)

    if (colMap) {
      console.error('Column indices used:', colMap)
      const hdr = rows[headerRow] || []
      console.error('Raw header row (cols 0-30):', hdr.slice(0, 30))
    } else {
      console.error('No suitable header row containing Type + product-name + Qty columns was detected in the first 15 rows.')
      console.error('First 3 raw rows (for inspection):')
      for (let k = 0; k < Math.min(3, rows.length); k++) {
        console.error(`  Row ${k}:`, rows[k]?.slice(0, 15))
      }
    }

    // Show what the parser actually saw in the columns it decided to use
    const sampleStart = Math.max(0, startRow)
    const samples = rows.slice(sampleStart, sampleStart + 8).map((r, idx) => {
      const actualRow = sampleStart + idx + 1
      return {
        excelRow: actualRow,
        Type: toStr(getCell(r, getIdx('type'))),
        Qty_raw: getCell(r, getIdx('qty')),
        Qty_parsed: toNumber(getCell(r, getIdx('qty'))),
        Memo: toStr(getCell(r, getIdx('memo'))),
        Customer: toStr(getCell(r, getIdx('name'))),
        Class: toStr(getCell(r, getIdx('class'))),
      }
    })
    console.error('First data rows using the chosen columns:', samples)

    const anyInvoice = rows.some(r => r.some(c => toStr(c)?.toLowerCase() === 'invoice'))
    console.error('Does the file contain the word "Invoice" anywhere?', anyInvoice)
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER — Simple sales list (product, quantity, invoice_number, customer, location, date)
//
// This is the format the user had (not a classic QuickBooks export).
// We auto-detect the header and map the obvious columns.
// ─────────────────────────────────────────────────────────────────────────────

export function parseSimpleSales(buffer: ArrayBuffer): ParsedSalesRow[] {
  let { rows } = readSheetAsRows(buffer)
  const out: ParsedSalesRow[] = []

  // --- Handle the very common case where user pasted CSV text into Excel column A ---
  // In this case every row has only 1 cell containing the full "product,quantity,invoice..." line
  const looksLikePastedCsv = rows.length > 1 &&
    rows[1] &&
    rows[1].length <= 2 &&
    typeof rows[1][0] === 'string' &&
    (rows[1][0] as string).includes(',');

  if (looksLikePastedCsv) {
    const rebuilt: unknown[][] = [];
    for (const row of rows) {
      const cell = toStr(getCell(row, 0)) || '';
      if (cell.includes(',')) {
        // Split by comma, but be careful with commas inside product names (they usually have parentheses)
        const parts = cell.split(',').map(s => s.trim());
        rebuilt.push(parts);
      } else {
        rebuilt.push(row);
      }
    }
    rows = rebuilt;
  }

  // Find a header row that contains "product" + "quantity" (or "qty")
  let headerRow = -1
  let col: Record<string, number> = {}

  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const norm = rows[r].map((c) => toStr(c)?.toLowerCase() ?? '')
    const iProduct = norm.findIndex((c) => c.includes('product'))
    const iQty = norm.findIndex((c) => c.includes('quantity') || c.includes('qty'))
    const iInvoice = norm.findIndex((c) => c.includes('invoice'))
    const iCustomer = norm.findIndex((c) => c.includes('customer'))
    const iLocation = norm.findIndex((c) => c.includes('location') || c.includes('branch'))
    const iDate = norm.findIndex((c) => c.includes('date'))

    if (iProduct >= 0 && iQty >= 0) {
      headerRow = r
      col = {
        product: iProduct,
        qty: iQty,
        invoice: iInvoice,
        customer: iCustomer,
        location: iLocation,
        date: iDate,
      }
      break
    }
  }

  if (headerRow < 0) {
    // Last-resort assumption based on the exact file the user uploaded
    headerRow = 0
    col = { product: 0, qty: 1, invoice: 2, customer: 3, location: 4, date: 5 }
  }

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    const rawProduct = toStr(getCell(row, col.product))
    const qty = toNumber(getCell(row, col.qty))
    if (!rawProduct || qty === null) continue

    const loc = toStr(getCell(row, col.location))
    const branch = normaliseBranch(loc) ?? 'nairobi'

    out.push({
      source_row: i + 1,
      movement_date: toDate(getCell(row, col.date)),
      order_number: toStr(getCell(row, col.invoice)),
      raw_product_name: rawProduct,
      customer_name: toStr(getCell(row, col.customer)),
      branch,
      qty: Math.abs(Math.round(qty)),
      unit_price: null,
      amount: null,
      notes: null,
    })
  }

  // Final safety net: if we still got nothing, try the classic 6-column layout
  // (product | quantity | invoice | customer | location | date)
  // This helps when the user pasted CSV text into Excel without splitting columns.
  if (out.length === 0) {
    const fallbackCol = { product: 0, qty: 1, invoice: 2, customer: 3, location: 4, date: 5 }
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const rawProduct = toStr(getCell(row, fallbackCol.product))
      const qty = toNumber(getCell(row, fallbackCol.qty))
      if (!rawProduct || qty === null) continue

      const loc = toStr(getCell(row, fallbackCol.location))
      const branch = normaliseBranch(loc) ?? 'nairobi'

      out.push({
        source_row: i + 1,
        movement_date: toDate(getCell(row, fallbackCol.date)),
        order_number: toStr(getCell(row, fallbackCol.invoice)),
        raw_product_name: rawProduct,
        customer_name: toStr(getCell(row, fallbackCol.customer)),
        branch,
        qty: Math.abs(Math.round(qty)),
        unit_price: null,
        amount: null,
        notes: null,
      })
    }
  }

  if (out.length === 0) {
    console.error('=== Simple Sales Parser - 0 rows produced ===')
    console.error('Total rows read from sheet:', rows.length)
    console.error('Header row index found by detector:', headerRow)
    console.error('Column indices used:', col)
    console.error('First 8 raw rows:', rows.slice(0, 8))
    console.error(
      'First candidate rows using chosen columns:',
      rows.slice(Math.max(1, headerRow + 1), Math.max(1, headerRow + 1) + 8).map((row, idx) => ({
        excelRow: Math.max(1, headerRow + 1) + idx + 1,
        product: toStr(getCell(row, col.product)),
        qtyRaw: getCell(row, col.qty),
        qtyParsed: toNumber(getCell(row, col.qty)),
        invoice: toStr(getCell(row, col.invoice)),
        customer: toStr(getCell(row, col.customer)),
        location: toStr(getCell(row, col.location)),
        date: getCell(row, col.date),
      }))
    )
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER 2 — Springs master list
//
// Sheet: SPRINGS LIST
// Pattern:
//   Vehicle-make group row: single cell in column 1, no code in column 2
//     e.g. "BEDFORD J6"
//   Product row: name in column 1, code in column 2
//     e.g. ["BEDFORD J6 FRONT SPRING ASSLY 9L", "BEDFORD/FSA9LF"]
//
// We track the current vehicle make as we iterate, and emit product rows.
// ─────────────────────────────────────────────────────────────────────────────

export function parseSpringsList(buffer: ArrayBuffer): ParsedProductRow[] {
  const { rows } = readSheetAsRows(buffer, 'SPRINGS LIST')
  const out: ParsedProductRow[] = []
  let currentMake: string | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const col1 = toStr(getCell(row, 0))
    const col2 = toStr(getCell(row, 1))

    // Check if this is a vehicle make group row
    if (col1 && !col2 && col1 === col1.toUpperCase() && col1.length > 3) {
      currentMake = col1.trim()
      continue
    }

    // Skip if no name or code
    if (!col1 || !col2) continue

    const name = col1.trim()
    const code = col2.trim()

    // Skip headers
    if (name.toLowerCase().includes('description') || code.toLowerCase().includes('code')) continue

    // Infer spring details from name
    const { spring_position, leaf_position, product_type } = inferSpringDetails(name)

    out.push({
      source_row: i + 1,
      product_code: code,
      canonical_name: name,
      category: 'springs',
      product_type,
      uom: 'pcs',
      vehicle_make: currentMake,
      vehicle_model: null,
      spring_position,
      leaf_position,
      cost_price: null,
      selling_price: null,
    })
  }

  return out
}

function inferSpringDetails(name: string): { spring_position: string | null; leaf_position: string | null; product_type: string } {
  const lower = name.toLowerCase()

  let spring_position: string | null = null
  let leaf_position: string | null = null
  const product_type = 'spring'

  if (lower.includes('front')) {
    spring_position = 'front'
  } else if (lower.includes('rear')) {
    spring_position = 'rear'
  } else if (lower.includes('helper') || lower.includes('aux')) {
    spring_position = 'helper'
  }

  if (lower.includes('main leaf') || lower.includes('main')) {
    leaf_position = 'main leaf'
  } else if (lower.includes('2nd leaf') || lower.includes('second')) {
    leaf_position = '2nd leaf'
  } else if (lower.includes('3rd leaf') || lower.includes('third')) {
    leaf_position = '3rd leaf'
  } else if (lower.includes('4th leaf') || lower.includes('fourth')) {
    leaf_position = '4th leaf'
  } else if (lower.includes('5th leaf') || lower.includes('fifth')) {
    leaf_position = '5th leaf'
  }

  return { spring_position, leaf_position, product_type }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER 3 — U-bolt master list
//
// Sheet: U BOLT LIST
// Headers are in row 2, data starts at row 3.
// Similar to springs but simpler structure.
// ─────────────────────────────────────────────────────────────────────────────

export function parseUBoltList(buffer: ArrayBuffer): ParsedProductRow[] {
  const { rows } = readSheetAsRows(buffer, 'U BOLT LIST')
  const out: ParsedProductRow[] = []

  // Skip first two rows (headers in row 2)
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    const col1 = toStr(getCell(row, 0))
    const col2 = toStr(getCell(row, 1))

    if (!col1 || !col2) continue

    const name = col1.trim()
    const code = col2.trim()

    if (name.toLowerCase().includes('description') || code.toLowerCase().includes('code')) continue

    out.push({
      source_row: i + 1,
      product_code: code,
      canonical_name: name,
      category: 'ubolts',
      product_type: 'u-bolt',
      uom: 'pcs',
      vehicle_make: null,
      vehicle_model: null,
      spring_position: null,
      leaf_position: null,
      cost_price: null,
      selling_price: null,
    })
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER 4 — Consumables stock movements
//
// Multiple sheets ending with "IN-OUT" (e.g. "consumables IN-OUT").
// Each sheet has three side-by-side tables starting at row 5:
//   Left table (cols A-B): stock IN movements
//   Middle table (cols C-D): stock OUT movements
//   Right table (cols E-F): current balance (ignored for import)
//
// We emit one ParsedStockRow per product movement.
// ─────────────────────────────────────────────────────────────────────────────

export function parseConsumablesStock(
  buffer: ArrayBuffer,
  sheetName: string,
  branch: BranchCode
): ParsedStockRow[] {
  const { rows } = readSheetAsRows(buffer, sheetName)
  const out: ParsedStockRow[] = []

  // Start from row 0 and skip header-like rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (isConsumablesHeaderRow(row)) {
      continue
    }

    // Try common layouts:

    // Layout 1: Product | Qty In | Product | Qty Out  (columns 0-3)
    const inProduct = toStr(getCell(row, 0))
    const inQty = toNumber(getCell(row, 1))
    if (inProduct && inQty && inQty > 0) {
      out.push({
        source_row: i + 1,
        movement_date: null,
        raw_product_name: inProduct,
        branch,
        qty: inQty,
        direction: 'in',
        reference: `${sheetName} import`,
        notes: `Stock in from ${sheetName}`,
      })
    }

    const outProduct = toStr(getCell(row, 2))
    const outQty = toNumber(getCell(row, 3))
    if (outProduct && outQty && outQty > 0) {
      out.push({
        source_row: i + 1,
        movement_date: null,
        raw_product_name: outProduct,
        branch,
        qty: outQty,
        direction: 'out',
        reference: `${sheetName} import`,
        notes: `Stock out from ${sheetName}`,
      })
    }

    // Layout 2: Product | Name | Category | UOM | Branch | Current stock
    const snapshotProduct = toStr(getCell(row, 0))
    const snapshotQty = toNumber(getCell(row, 5))
    if (snapshotProduct && snapshotQty !== null && snapshotQty !== 0) {
      out.push({
        source_row: i + 1,
        movement_date: null,
        raw_product_name: snapshotProduct,
        branch,
        qty: Math.abs(snapshotQty),
        direction: snapshotQty > 0 ? 'in' : 'out',
        reference: `${sheetName} import`,
        notes: `Stock snapshot from ${sheetName}`,
      })
      continue
    }

    // Layout 2: Product | Qty  (single movement per row, assume IN)
    const product = toStr(getCell(row, 0))
    const qty = toNumber(getCell(row, 1))
    if (product && qty && qty > 0 && !inProduct && !outProduct) {
      out.push({
        source_row: i + 1,
        movement_date: null,
        raw_product_name: product,
        branch,
        qty: qty,
        direction: 'in',
        reference: `${sheetName} import`,
        notes: `Stock import from ${sheetName}`,
      })
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED WORKBOOK PARSER (Enhanced Global Parser)
// Handles manufacturing data matrices + consumables + auto parts + sales
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductPayload {
  name: string
  uom: string
  opening_stock: number
  current_stock: number
  location: 'Mombasa' | 'Nairobi'
  category: 'Consumables' | 'Trailer Parts' | 'Brake Linings' | 'Springs' | 'Raw Material'
}

export interface SaleTransactionPayload {
  product_name: string
  quantity: number
  transaction_date: string
  invoice_number: string | null
  customer_name: string | null
  location: 'Mombasa' | 'Nairobi'
}

export interface StockInPayload {
  product_name: string
  quantity: number
  transaction_date: string
  reference_memo: string | null
  location: 'Mombasa' | 'Nairobi'
}

export interface ParsedWorkbookResult {
  products: ProductPayload[]
  sales: SaleTransactionPayload[]
  purchases: StockInPayload[]
}

export function parseAllWorkbooksUnified(
  workbook: XLSX.WorkBook,
  location: 'Mombasa' | 'Nairobi'
): ParsedWorkbookResult {
  const result: ParsedWorkbookResult = { products: [], sales: [], purchases: [] }

  for (const sheetName of workbook.SheetNames) {
    const upperName = sheetName.toUpperCase()
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null })

    let category: ProductPayload['category'] = 'Trailer Parts'
    if (upperName.includes('CONSUMABLE')) category = 'Consumables'
    else if (upperName.includes('BRAKE')) category = 'Brake Linings'
    else if (upperName.includes('SPRING') || upperName.includes('FINISHED')) category = 'Springs'
    else if (upperName.includes('RAW') || upperName.includes('BAR')) category = 'Raw Material'

    let headerRowIndex = -1
    const map = {
      inDate: -1, inItem: -1, inQty: -1,
      outDate: -1, outItem: -1, outQty: -1,
      balItem: -1, balOpStock: -1, balCurrentStock: -1, balUom: -1
    }

    for (let i = 0; i < rows.length; i++) {
      if (!rows[i]) continue
      const rowNorm = rows[i].map((c: any) => String(c || '').trim().toUpperCase())

      if ((rowNorm.includes('PRODUCT DESCRIPTION') || rowNorm.includes('PRODUCT DESCRIPTION3')) &&
          (rowNorm.includes('QTY') || rowNorm.includes('BALANCE STOCK') || rowNorm.includes('B. STOCK'))) {
        headerRowIndex = i
        rowNorm.forEach((cell: string, idx: number) => {
          if (cell === 'DATE' && map.inDate === -1) map.inDate = idx
          if ((cell === 'PRODUCT DESCRIPTION' || cell === 'PRODUCT DESCRIPTION2') && map.inItem === -1) map.inItem = idx
          if ((cell === 'QTY' || cell === 'QUANTITY') && map.inQty === -1) map.inQty = idx

          if (cell === 'DATE' && map.inDate !== -1 && idx > map.inDate) map.outDate = idx
          if ((cell === 'PRODUCT DESCRIPTION' || cell === 'PRODUCT DESCRIPTION2') && map.inItem !== -1 && idx > map.inItem) map.outItem = idx
          if ((cell === 'QTY' || cell === 'QTY2' || cell === 'QUANTITY2') && map.inQty !== -1 && idx > map.inQty) map.outQty = idx

          if ((cell === 'PRODUCT DESCRIPTION' || cell === 'PRODUCT DESCRIPTION3') && idx > map.outItem) map.balItem = idx
          if (cell === 'OP. STOCK' || cell === 'OPENING STOCK' || cell === 'OP STOCK') map.balOpStock = idx
          if (cell === 'BALANCE STOCK' || cell === 'CURRENT BALANCE' || cell === 'B. STOCK') map.balCurrentStock = idx
          if (cell === 'UOM' || cell === 'U/M') map.balUom = idx
        })
        break
      }
    }

    if (headerRowIndex !== -1) {
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0) continue

        if (row[map.inItem] && String(row[map.inItem]).trim() !== '') {
          result.purchases.push({
            product_name: String(row[map.inItem]).trim(),
            quantity: Number(row[map.inQty]) || 0,
            transaction_date: row[map.inDate] ? new Date(row[map.inDate]).toISOString() : new Date().toISOString(),
            reference_memo: `Inbound Ledger entry on sheet: ${sheetName}`,
            location
          })
        }

        if (row[map.outItem] && String(row[map.outItem]).trim() !== '') {
          result.sales.push({
            product_name: String(row[map.outItem]).trim(),
            quantity: Number(row[map.outQty]) || 0,
            transaction_date: row[map.outDate] ? new Date(row[map.outDate]).toISOString() : new Date().toISOString(),
            invoice_number: row[map.outDate + 1] ? String(row[map.outDate + 1]) : null,
            customer_name: row[map.outDate + 2] ? String(row[map.outDate + 2]) : null,
            location
          })
        }

        const balItemName = row[map.balItem]
        if (balItemName && String(balItemName).trim() !== '' &&
            !['CONSUMABLES', 'DOLL', 'SPRINGTECH'].includes(String(balItemName).toUpperCase())) {
          result.products.push({
            name: String(balItemName).trim(),
            uom: row[map.balUom] ? String(row[map.balUom]).trim() : 'Pcs',
            opening_stock: Number(row[map.balOpStock]) || 0,
            current_stock: Number(row[map.balCurrentStock]) || 0,
            location,
            category
          })
        }
      }
    }
  }

  return result
}
