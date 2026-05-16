// Column mapping configurations for different Excel sheet types
export interface ColumnMapping {
  [key: string]: {
    targetField: string
    required?: boolean
    transform?: (value: any) => any
  }
}

export const SHEET_MAPPINGS: Record<string, ColumnMapping> = {
  // Mombasa inventory sheets (BRAKE LININGS IN-OUT, CENTRE BOLTS, etc.)
  inventory: {
    'PRODUCT DESCRIPTION': { targetField: 'raw_product_name', required: true },
    'DESCRIPTION': { targetField: 'raw_product_name', required: true },
    'ITEM': { targetField: 'raw_product_name', required: true },
    'OPENING STOCK': { targetField: 'opening_stock', transform: (v) => parseFloat(v) || 0 },
    'STOCK IN': { targetField: 'stock_in', transform: (v) => parseFloat(v) || 0 },
    'STOCK OUT': { targetField: 'stock_out', transform: (v) => parseFloat(v) || 0 },
    'BALANCE STOCK': { targetField: 'qty', required: true, transform: (v) => parseFloat(v) || 0 },
    'CURRENT STOCK': { targetField: 'qty', required: true, transform: (v) => parseFloat(v) || 0 },
    'STOCK STATUS': { targetField: 'stock_status' },
    'RE-ORDER STOCK': { targetField: 'reorder_level', transform: (v) => parseFloat(v) || 0 },
    'UNIT COST': { targetField: 'unit_cost', transform: (v) => parseFloat(v) || 0 },
    'UNIT PRICE': { targetField: 'unit_price', transform: (v) => parseFloat(v) || 0 },
    'VENDOR': { targetField: 'vendor' },
    'SUPPLIER': { targetField: 'vendor' },
    'LOCATION': { targetField: 'branch', transform: (v) => normalizeBranch(v) },
    'BRANCH': { targetField: 'branch', transform: (v) => normalizeBranch(v) },
  },

  // Stock movement sheets
  stock_movement: {
    'DATE': { targetField: 'movement_date', transform: (v) => new Date(v) },
    'PRODUCT': { targetField: 'raw_product_name', required: true },
    'DESCRIPTION': { targetField: 'raw_product_name', required: true },
    'MOVEMENT TYPE': { targetField: 'movement_type' },
    'TYPE': { targetField: 'movement_type' },
    'QUANTITY': { targetField: 'qty', required: true, transform: (v) => parseFloat(v) || 0 },
    'AMOUNT': { targetField: 'qty', required: true, transform: (v) => parseFloat(v) || 0 },
    'REFERENCE': { targetField: 'reference' },
    'NOTES': { targetField: 'notes' },
    'BRANCH': { targetField: 'branch', transform: (v) => normalizeBranch(v) },
    'LOCATION': { targetField: 'branch', transform: (v) => normalizeBranch(v) },
  },

  // Sales data sheets
  sales: {
    'DATE': { targetField: 'movement_date', transform: (v) => new Date(v) },
    'INVOICE': { targetField: 'order_number', required: true },
    'ORDER NUMBER': { targetField: 'order_number', required: true },
    'CUSTOMER': { targetField: 'customer_name', required: true },
    'CLIENT': { targetField: 'customer_name', required: true },
    'PRODUCT': { targetField: 'raw_product_name', required: true },
    'DESCRIPTION': { targetField: 'raw_product_name', required: true },
    'QUANTITY': { targetField: 'qty', required: true, transform: (v) => parseFloat(v) || 0 },
    'QTY': { targetField: 'qty', required: true, transform: (v) => parseFloat(v) || 0 },
    'UNIT PRICE': { targetField: 'unit_price', transform: (v) => parseFloat(v) || 0 },
    'PRICE': { targetField: 'unit_price', transform: (v) => parseFloat(v) || 0 },
    'TOTAL': { targetField: 'total_price', transform: (v) => parseFloat(v) || 0 },
    'BRANCH': { targetField: 'branch', transform: (v) => normalizeBranch(v) },
  }
}

// Auto-detect sheet type based on column headers
export function detectSheetType(headers: string[]): string {
  const headerSet = new Set(headers.map(h => h.toUpperCase().trim()))

  // Check for inventory-specific columns
  if (headerSet.has('BALANCE STOCK') || headerSet.has('OPENING STOCK') || headerSet.has('STOCK STATUS')) {
    return 'inventory'
  }

  // Check for movement-specific columns
  if (headerSet.has('MOVEMENT TYPE') || headerSet.has('STOCK IN') || headerSet.has('STOCK OUT')) {
    return 'stock_movement'
  }

  // Check for sales-specific columns
  if (headerSet.has('INVOICE') || headerSet.has('CUSTOMER') || headerSet.has('ORDER NUMBER')) {
    return 'sales'
  }

  // Default to inventory if unclear
  return 'inventory'
}

// Normalize branch names to match our enum values
function normalizeBranch(branchName: string): string {
  if (!branchName) return 'mombasa'

  const normalized = branchName.toLowerCase().trim()

  if (normalized.includes('mombasa') || normalized.includes('hq')) {
    return 'mombasa'
  }
  if (normalized.includes('nairobi')) {
    return 'nairobi'
  }
  if (normalized.includes('bonje') || normalized.includes('bunje')) {
    return 'bonje'
  }

  return 'mombasa' // default
}