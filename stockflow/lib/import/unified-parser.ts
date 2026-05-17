import * as XLSX from 'xlsx'

export type UnifiedLocation = 'Mombasa' | 'Nairobi'

export interface UnifiedDataBundle {
  location: UnifiedLocation
  products: Array<{
    name: string
    uom: string
    opening_stock: number
    current_stock: number
    category: string
  }>
  sales: Array<{
    product_name: string
    quantity: number
    transaction_date: string
    invoice_num: string | null
    customer: string | null
  }>
  purchases: Array<{
    product_name: string
    quantity: number
    transaction_date: string
    memo: string | null
  }>
}

function detectLocationFromFilename(filename: string): UnifiedLocation {
  const upper = filename.toUpperCase()
  if (upper.includes('NAIROBI')) return 'Nairobi'
  return 'Mombasa'
}

function normalizeName(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!s) return null
  return s.toUpperCase()
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return isNaN(value) ? null : value
  const cleaned = String(value).replace(/[,\s]/g, '')
  const n = Number(cleaned)
  return isNaN(n) ? null : n
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    // Excel serial date: 1899-12-30
    const epoch = new Date(1899, 11, 30)
    return new Date(epoch.getTime() + value * 86400000)
  }
  const s = String(value).trim()
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d
}

function inferCategoryFromSheetName(sheetName: string): string {
  const upper = sheetName.toUpperCase()
  if (upper.includes('CONSUMABLE')) return 'Consumables'
  if (upper.includes('BRAKE')) return 'Brake Linings'
  if (upper.includes('BOLT')) return 'Center/U-Bolts'
  if (upper.includes('NUT')) return 'Nuts'
  if (upper.includes('SPRING') || upper.includes('FINISHED')) return 'Springs'
  if (upper.includes('RAW') || upper.includes('BAR') || upper.includes('BUSHES'))
    return 'Raw Materials'
  return 'Trailer Parts'
}

function looksLikeQuickbooksLedger(rows: unknown[][]): boolean {
  if (rows.length < 2) return false

  // Header-based check (preferred)
  const header = (rows[0] ?? []).map((c) => String(c ?? '').trim().toUpperCase())
  const hasType = header.some((h) => h === 'TYPE')
  const hasDate = header.some((h) => h === 'DATE')
  const hasNum = header.some((h) => h === 'NUM' || h === 'NUMBER')
  if (hasType && hasDate && hasNum) return true

  // Fallback: QuickBooks "Invoice" type tends to appear in column H (7)
  return rows.some((r) => String((r as any[])[7] ?? '').trim() === 'Invoice')
}

function parseQuickbooksLedger(rows: unknown[][]): UnifiedDataBundle['sales'] {
  const out: UnifiedDataBundle['sales'] = []

  // Column layout:
  // 7: Type, 9: Date, 11: Num (invoice number), 13: Memo (product), 15: Name (customer), 19: Qty
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as any[]
    const txType = String(row?.[7] ?? '').trim()
    if (txType !== 'Invoice' && txType !== 'Cash Sale') continue

    const rawName = normalizeName(row?.[13])
    const qty = toNumber(row?.[19])
    if (!rawName || qty === null) continue

    const txDate = toDate(row?.[9]) ?? new Date()

    out.push({
      product_name: rawName,
      quantity: Math.abs(qty),
      transaction_date: txDate.toISOString(),
      invoice_num: row?.[11] ? String(row[11]).trim() : null,
      customer: row?.[15] ? String(row[15]).trim() : null,
    })
  }

  return out
}

type MatrixMap = {
  inDate: number
  inItem: number
  inQty: number
  outDate: number
  outItem: number
  outQty: number
  balItem: number
  balOp: number
  balCurr: number
  balUom: number
}

function findMatrixHeader(rows: unknown[][]): { headerIdx: number; map: MatrixMap } | null {
  const map: MatrixMap = {
    inDate: -1,
    inItem: -1,
    inQty: -1,
    outDate: -1,
    outItem: -1,
    outQty: -1,
    balItem: -1,
    balOp: -1,
    balCurr: -1,
    balUom: -1,
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as any[] | undefined
    if (!row) continue
    const normCells = row.map((c) => String(c ?? '').trim().toUpperCase())

    const hasProductHeader =
      normCells.includes('PRODUCT DESCRIPTION') ||
      normCells.includes('PRODUCT DESCRIPTION2') ||
      normCells.includes('PRODUCT DESCRIPTION3')
    const hasQtyOrBalance =
      normCells.includes('QTY') ||
      normCells.includes('QUANTITY') ||
      normCells.includes('BALANCE STOCK') ||
      normCells.includes('B. STOCK')

    if (!hasProductHeader || !hasQtyOrBalance) continue

    normCells.forEach((cell, idx) => {
      // In block
      if (cell === 'DATE' && map.inDate === -1) map.inDate = idx
      if ((cell === 'PRODUCT DESCRIPTION' || cell === 'PRODUCT DESCRIPTION2') && map.inItem === -1) {
        map.inItem = idx
      }
      if ((cell === 'QTY' || cell === 'QUANTITY') && map.inQty === -1) map.inQty = idx

      // Out block (same headers repeated later in the row)
      if (cell === 'DATE' && map.inDate !== -1 && idx > map.inDate) map.outDate = idx
      if (
        (cell === 'PRODUCT DESCRIPTION' || cell === 'PRODUCT DESCRIPTION2') &&
        map.inItem !== -1 &&
        idx > map.inItem
      ) {
        map.outItem = idx
      }
      if (
        (cell === 'QTY' || cell === 'QTY2' || cell === 'QUANTITY2' || cell === 'QUANTITY') &&
        map.inQty !== -1 &&
        idx > map.inQty
      ) {
        map.outQty = idx
      }

      // Balance block (right side)
      if (
        (cell === 'PRODUCT DESCRIPTION' || cell === 'PRODUCT DESCRIPTION3') &&
        map.outItem !== -1 &&
        idx > map.outItem
      ) {
        map.balItem = idx
      }
      if (cell === 'OP. STOCK' || cell === 'OPENING STOCK' || cell === 'OP STOCK') map.balOp = idx
      if (cell === 'BALANCE STOCK' || cell === 'CURRENT BALANCE' || cell === 'B. STOCK') map.balCurr = idx
      if (cell === 'UOM' || cell === 'U/M' || cell === 'U/M.') map.balUom = idx
    })

    return { headerIdx: i, map }
  }

  return null
}

function shouldIgnoreBalanceName(name: string): boolean {
  const upper = name.toUpperCase()
  return upper === 'CONSUMABLES' || upper === 'DOLL' || upper === 'SPRINGTECH' || upper === 'TOTAL'
}

export function parseIncomingWorkbook(workbook: XLSX.WorkBook, filename: string): UnifiedDataBundle {
  const location = detectLocationFromFilename(filename)
  const bundle: UnifiedDataBundle = { location, products: [], sales: [], purchases: [] }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null }) as unknown[][]
    if (rows.length === 0) continue

    const category = inferCategoryFromSheetName(sheetName)

    // ── Archetype A: QuickBooks ledger ──────────────────────────────────────
    if (looksLikeQuickbooksLedger(rows)) {
      bundle.sales.push(...parseQuickbooksLedger(rows))
      continue
    }

    // ── Archetype B: Stock matrix (IN / OUT / BALANCE) ─────────────────────
    const header = findMatrixHeader(rows)
    if (!header) continue

    const { headerIdx, map } = header

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] as any[] | undefined
      if (!row || row.length === 0) continue

      // Purchases / inflows
      if (map.inItem !== -1) {
        const inName = normalizeName(row[map.inItem])
        const inQty = map.inQty !== -1 ? toNumber(row[map.inQty]) : null
        if (inName && inQty !== null && inQty !== 0) {
          const d = map.inDate !== -1 ? toDate(row[map.inDate]) : null
          bundle.purchases.push({
            product_name: inName,
            quantity: inQty,
            transaction_date: (d ?? new Date()).toISOString(),
            memo: `Imported via sheet: ${sheetName}`,
          })
        }
      }

      // Sales / dispatches
      if (map.outItem !== -1) {
        const outName = normalizeName(row[map.outItem])
        const outQty = map.outQty !== -1 ? toNumber(row[map.outQty]) : null
        if (outName && outQty !== null && outQty !== 0) {
          const d = map.outDate !== -1 ? toDate(row[map.outDate]) : null
          bundle.sales.push({
            product_name: outName,
            quantity: Math.abs(outQty),
            transaction_date: (d ?? new Date()).toISOString(),
            invoice_num:
              map.outDate !== -1 && row[map.outDate + 1] ? String(row[map.outDate + 1]).trim() : null,
            customer:
              map.outDate !== -1 && row[map.outDate + 2] ? String(row[map.outDate + 2]).trim() : null,
          })
        }
      }

      // Current balances / master list
      if (map.balItem !== -1) {
        const balName = normalizeName(row[map.balItem])
        if (balName && !shouldIgnoreBalanceName(balName)) {
          bundle.products.push({
            name: balName,
            uom: map.balUom !== -1 && row[map.balUom] ? String(row[map.balUom]).trim() : 'Pcs',
            opening_stock: map.balOp !== -1 ? toNumber(row[map.balOp]) ?? 0 : 0,
            current_stock: map.balCurr !== -1 ? toNumber(row[map.balCurr]) ?? 0 : 0,
            category,
          })
        }
      }
    }
  }

  return bundle
}

