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
export type BranchCode = 'mombasa' | 'nairobi' | 'bonje'

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
  category: 'manufactured_spring' | 'manufactured_ubolt' | 'imported' | 'local_purchase'
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

// ─────────────────────────────────────────────────────────────────────────────
// SHEET TYPE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export type SpecializedSheetType =
  | 'sales_quickbooks_v2'
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

        // Check for QuickBooks sales export
        if (sheetNames.length === 1) {
          const ws = wb.Sheets[sheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
          if (rows.length > 1) {
            // Look for "Invoice" in column H (7)
            const hasInvoiceType = rows.some((row) => toStr(getCell(row, 7)) === 'Invoice')
            if (hasInvoiceType) {
              return resolve({
                recommendedSheetType: 'sales_quickbooks_v2',
                sheetNames,
                reason: 'Found "Invoice" entries in column H — looks like QuickBooks export',
              })
            }
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

        // Check for consumables stock (sheets ending with IN-OUT)
        const inOutSheets = sheetNames.filter((n) => n.toUpperCase().includes('IN-OUT'))
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
  if (lower.includes('bonje')) return 'bonje'
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

// ─────────────────────────────────────────────────────────────────────────────
// PARSER 1 — QuickBooks sales export
//
// Column layout:
//   7: Type (we filter to "Invoice")
//   9: Date
//   11: Num (invoice number)
//   13: Memo (product name)
//   15: Name (customer)
//   17: Class (branch)
//   19: Qty
//   23: Sales Price
//   25: Amount
//
// We only keep rows where col 7 === "Invoice".
// ─────────────────────────────────────────────────────────────────────────────

export function parseSalesQuickbooks(buffer: ArrayBuffer): ParsedSalesRow[] {
  const { rows } = readSheetAsRows(buffer)
  const out: ParsedSalesRow[] = []

  // Skip header row (row 1, index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const typeCell = toStr(getCell(row, 7))
    if (typeCell !== 'Invoice') continue

    const qty = toNumber(getCell(row, 19))
    const memo = toStr(getCell(row, 13))
    if (qty === null || !memo) continue // require qty and product name

    const originalBranchLabel = toStr(getCell(row, 17))
    const normalisedBranch = normaliseBranch(originalBranchLabel)
    // If the original was "Upcountry", note it so the audit trail preserves it
    const branchNote =
      originalBranchLabel && originalBranchLabel.toLowerCase().includes('upcountry')
        ? `Upcountry sale (assigned to Mombasa)`
        : null

    out.push({
      source_row: i + 1, // 1-indexed for user-facing reference
      movement_date: toDate(getCell(row, 9)),
      order_number: toStr(getCell(row, 11)),
      raw_product_name: memo,
      customer_name: toStr(getCell(row, 15)),
      branch: normalisedBranch,
      qty: Math.abs(Math.round(qty)),
      unit_price: toNumber(getCell(row, 23)),
      amount: toNumber(getCell(row, 25)),
      notes: branchNote,
    })
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
      category: 'manufactured_spring',
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
      category: 'manufactured_ubolt',
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

  for (let i = 4; i < rows.length; i++) {
    const row = rows[i]

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
