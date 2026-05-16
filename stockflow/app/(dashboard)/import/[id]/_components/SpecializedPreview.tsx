'use client'

import { useState, useTransition } from 'react'
import { approveAndSyncImport } from '../../actions'
import type { ImportBatch, ImportRow } from '@prisma/client'
import * as XLSX from 'xlsx'

interface SpecializedPreviewProps {
  batch: ImportBatch & {
    rows: ImportRow[]
  }
}

export function SpecializedPreview({ batch }: SpecializedPreviewProps) {
  const [isPending, startTransition] = useTransition()
  const [previewData, setPreviewData] = useState<any[]>([])

  // Load preview data on mount
  useState(() => {
    if (batch.file_url) {
      try {
        const workbook = XLSX.read(Buffer.from(batch.file_url, 'base64'), { type: 'buffer', cellDates: true })

        switch (batch.sheet_type) {
          case 'springs_stock':
            const springsData = parseSpringsList(workbook)
            setPreviewData(springsData.slice(0, 10))
            break
          case 'consumables':
            const consumablesData = parseConsumablesStock(workbook, batch.target_branch)
            setPreviewData(consumablesData.slice(0, 10))
            break
          case 'sales_quickbooks':
            const salesData = parseSalesQuickbooks(workbook)
            setPreviewData(salesData.slice(0, 10))
            break
        }
      } catch (error) {
        console.error('Failed to load preview:', error)
      }
    }
  })

  function handleCommit() {
    startTransition(async () => {
      await approveAndSyncImport(batch.id)
    })
  }

  const renderPreviewTable = () => {
    switch (batch.sheet_type) {
      case 'springs_stock':
        return (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Vehicle Make</th>
                  <th className="text-left p-3">Spring Position</th>
                  <th className="text-left p-3">Leaf Position</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((item: any, index) => (
                  <tr key={index} className="border-b border-border/50">
                    <td className="p-3 font-mono text-sm">{item.code}</td>
                    <td className="p-3">{item.name}</td>
                    <td className="p-3">{item.vehicle_make}</td>
                    <td className="p-3">{item.spring_position}</td>
                    <td className="p-3">{item.leaf_position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

      case 'consumables':
        return (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3">Product Name</th>
                  <th className="text-left p-3">Movement Type</th>
                  <th className="text-left p-3">Quantity</th>
                  <th className="text-left p-3">Branch</th>
                  <th className="text-left p-3">Sheet</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((item: any, index) => (
                  <tr key={index} className="border-b border-border/50">
                    <td className="p-3">{item.product_name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.movement_type === 'stock_in'
                          ? 'bg-green-500/10 text-green-600'
                          : 'bg-red-500/10 text-red-600'
                      }`}>
                        {item.movement_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{item.qty}</td>
                    <td className="p-3">{item.branch}</td>
                    <td className="p-3 text-sm text-muted">{item.rawData?.sheet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

      case 'sales_quickbooks':
        return (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Invoice #</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Product</th>
                  <th className="text-left p-3">Qty</th>
                  <th className="text-left p-3">Unit Price</th>
                  <th className="text-left p-3">Amount</th>
                  <th className="text-left p-3">Branch</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((item: any, index) => (
                  <tr key={index} className="border-b border-border/50">
                    <td className="p-3 text-sm">{item.date?.toLocaleDateString()}</td>
                    <td className="p-3 font-mono text-sm">{item.invoice_num}</td>
                    <td className="p-3">{item.customer_name}</td>
                    <td className="p-3">{item.product_name}</td>
                    <td className="p-3 font-mono">{item.qty}</td>
                    <td className="p-3 font-mono">{item.unit_price?.toFixed(2)}</td>
                    <td className="p-3 font-mono">{item.amount?.toFixed(2)}</td>
                    <td className="p-3">{item.branch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

      default:
        return <div>Unknown specialized type</div>
    }
  }

  const getSheetTypeDescription = () => {
    switch (batch.sheet_type) {
      case 'springs_stock':
        return 'Springs master list - Products will be created/updated with spring specifications'
      case 'consumables':
        return 'Branch consumables stock - Stock movements will be applied to inventory'
      case 'sales_quickbooks':
        return 'QuickBooks sales export - Sales orders and stock reductions will be created'
      default:
        return ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="card p-6">
        <h3 className="font-head text-lg font-bold mb-2">Import Preview</h3>
        <p className="text-muted text-sm">{getSheetTypeDescription()}</p>
        <div className="mt-4 p-4 bg-blue/10 border border-blue/30 rounded-md">
          <p className="text-sm">
            <strong>Ready to import:</strong> {batch.row_count} rows parsed successfully.
            Click "Commit Import" to process this data into your system.
          </p>
        </div>
      </div>

      {/* Preview Table */}
      <div className="card p-6">
        <h3 className="font-head text-lg font-bold mb-4">Sample Data (First 10 Rows)</h3>
        {renderPreviewTable()}
        {batch.row_count > 10 && (
          <p className="text-sm text-muted mt-4">
            ... and {batch.row_count - 10} more rows
          </p>
        )}
      </div>

      {/* Commit Section */}
      <div className="card p-6">
        <h3 className="font-head text-lg font-bold mb-4">Commit Import</h3>
        <div className="bg-green/10 border border-green/30 p-4 rounded-md mb-4">
          <p className="text-sm text-green-700">
            All data has been validated. This import will:
          </p>
          <ul className="text-sm text-green-700 mt-2 space-y-1">
            {batch.sheet_type === 'springs_stock' && (
              <>
                <li>• Create/update {batch.row_count} spring products with specifications</li>
                <li>• Set up vehicle make and spring position data</li>
              </>
            )}
            {batch.sheet_type === 'consumables' && (
              <>
                <li>• Apply {batch.row_count} stock movements (in/out)</li>
                <li>• Update product inventory levels</li>
              </>
            )}
            {batch.sheet_type === 'sales_quickbooks' && (
              <>
                <li>• Create sales orders from invoice data</li>
                <li>• Reduce inventory for sold products</li>
                <li>• Create stock movement records</li>
              </>
            )}
          </ul>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleCommit}
            disabled={isPending}
            className="btn btn-primary"
          >
            {isPending ? 'Committing...' : 'Commit Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper functions (copied from specialized-parsers.ts)
function parseSpringsList(workbook: XLSX.WorkBook) {
  const sheetName = 'SPRINGS LIST'
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) return []

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: '',
    raw: false,
    header: 1
  }) as any[][]

  const products: any[] = []
  let currentVehicleMake = ''

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const col1 = row[0]?.toString().trim()
    const col2 = row[1]?.toString().trim()

    if (col1 && !col2 && col1 === col1.toUpperCase() && col1.length > 3) {
      currentVehicleMake = col1
      continue
    }

    if (!col1 || !col2) continue

    const name = col1
    const code = col2

    if (!name || !code || name.toLowerCase().includes('description') || code.toLowerCase().includes('code')) continue

    products.push({
      code,
      name,
      vehicle_make: currentVehicleMake,
      spring_position: 'Rear', // Default
      leaf_position: 'Main Leaf' // Default
    })
  }

  return products
}

function parseConsumablesStock(workbook: XLSX.WorkBook, targetBranch?: string) {
  const movements: any[] = []

  const relevantSheets = workbook.SheetNames.filter(name => name.endsWith('IN-OUT'))

  for (const sheetName of relevantSheets) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
      raw: false,
      header: 1
    }) as any[][]

    for (let i = 4; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 4) continue

      const leftProduct = row[0]?.toString().trim()
      const leftQty = parseFloat(row[1]?.toString() || '0')
      const rightProduct = row[2]?.toString().trim()
      const rightQty = parseFloat(row[3]?.toString() || '0')

      if (leftProduct && leftQty > 0) {
        movements.push({
          product_name: leftProduct,
          movement_type: 'stock_in',
          qty: leftQty,
          branch: targetBranch || 'mombasa',
          rawData: { sheet: sheetName }
        })
      }

      if (rightProduct && rightQty > 0) {
        movements.push({
          product_name: rightProduct,
          movement_type: 'stock_out',
          qty: rightQty,
          branch: targetBranch || 'mombasa',
          rawData: { sheet: sheetName }
        })
      }
    }
  }

  return movements
}

function parseSalesQuickbooks(workbook: XLSX.WorkBook) {
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) return []

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: '',
    raw: false,
    header: 1
  }) as any[][]

  const invoices: any[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 26) continue

    const type = row[6]?.toString()
    if (type !== 'Invoice') continue

    const date = new Date(row[8]?.toString())
    const invoiceNum = row[10]?.toString().trim()
    const memo = row[12]?.toString().trim()
    const customerName = row[14]?.toString().trim()
    const classValue = row[16]?.toString()
    const qty = parseFloat(row[18]?.toString() || '0')
    const salesPrice = parseFloat(row[22]?.toString() || '0')
    const amount = parseFloat(row[24]?.toString() || '0')

    if (!date || !invoiceNum || !memo || !customerName || !qty) continue

    const branch = classValue === 'Upcountry' ? 'mombasa' : 'mombasa' // Default to mombasa

    invoices.push({
      date,
      invoice_num: invoiceNum,
      customer_name: customerName,
      product_name: memo,
      qty,
      unit_price: salesPrice,
      amount: amount || (qty * salesPrice),
      branch
    })
  }

  return invoices
}