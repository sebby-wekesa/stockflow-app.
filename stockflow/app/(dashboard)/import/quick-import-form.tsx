'use client'

import { useState, useTransition } from 'react'
import { uploadSpecialized } from './actions'
import * as XLSX from 'xlsx'

type SheetTypeOption = {
  value: string
  label: string
  description: string
  needsBranch: boolean
}

const SHEET_TYPES: SheetTypeOption[] = [
  {
    value: 'sales_simple',
    label: 'Simple sales list',
    description:
      'Basic sales file with columns: product, quantity, invoice_number, customer, location, date.',
    needsBranch: false,
  },
  {
    value: 'sales_quickbooks_v2',
    label: 'QuickBooks sales export',
    description:
      'The "SALES_JAN-APR.xlsx" style file with scattered columns and product group headers (only for real QuickBooks exports).',
    needsBranch: false,
  },
  {
    value: 'springs_master',
    label: 'Springs master list',
    description:
      'The "SPRINGS LIST" sheet from the springs RM-WIP-FG file. Creates Product records.',
    needsBranch: false,
  },
  {
    value: 'ubolt_master',
    label: 'U-bolt master list',
    description:
      'The "U BOLT LIST" sheet from the springs file. Creates Product records.',
    needsBranch: false,
  },
  {
    value: 'consumables_stock',
    label: 'Branch consumables stock',
    description:
      'Consumables IN-OUT sheets (must contain "IN-OUT" in sheet name). Requires selecting the branch.',
    needsBranch: true,
  },
]

export function QuickImportForm({ assignedBranchName }: { assignedBranchName: string | null }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheetType, setSheetType] = useState<string>('sales_simple') // default to the most common case for you

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setError(null)

    if (!f) return

    const lower = f.name.toLowerCase()

    // First pass: filename hints (quick & safe)
    if (lower.includes('quickbook') || lower.includes('qb') || lower.includes('quick')) {
      setSheetType('sales_quickbooks_v2')
      return
    }
    if (lower.includes('consumable') || lower.includes('in-out') || lower.includes('in out')) {
      setSheetType('consumables_stock')
      return
    }
    if (lower.includes('spring') && !lower.includes('stock')) {
      setSheetType('springs_master')
      return
    }
    if (lower.includes('u bolt') || lower.includes('ubolt')) {
      setSheetType('ubolt_master')
      return
    }

    // Second pass: inspect actual file content (most reliable)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const firstSheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as any[][]
        if (rows.length === 0) return

        const header = rows[0].map((c: any) => String(c || '').trim().toLowerCase())

        const has = (name: string) => header.some((h: string) => h.includes(name))

        if (has('product') && (has('quantity') || has('qty')) && has('invoice')) {
          setSheetType('sales_simple')
          return
        }
        if (has('type') && has('memo') && has('qty')) {
          setSheetType('sales_quickbooks_v2')
          return
        }
        if (has('springs') || header.some((h) => h.includes('spring'))) {
          setSheetType('springs_master')
          return
        }
        if (has('u bolt') || has('ubolt')) {
          setSheetType('ubolt_master')
          return
        }
        if (header.some((h) => h.includes('in-out') || h.includes('consumable'))) {
          setSheetType('consumables_stock')
          return
        }

        // Default for anything that looks like a sales file
        if (has('product') || has('quantity') || has('invoice')) {
          setSheetType('sales_simple')
        }
      } catch {
        // If content inspection fails, fall back to filename
        if (lower.includes('sales') || lower.includes('invoice') || lower.includes('transaction')) {
          setSheetType('sales_simple')
        } else if (lower.includes('mombasa') || lower.includes('nairobi') || lower.includes('bonje')) {
          setSheetType('sales_simple')
        }
      }
    }
    reader.readAsArrayBuffer(f)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError('Please choose a file')
      return
    }
    const fd = new FormData(e.currentTarget)
    fd.set('file', file)

    fd.set('sheet_type', sheetType)
    startTransition(async () => {
      try {
        await uploadSpecialized(fd)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs uppercase tracking-wider text-muted mb-2">
          What kind of file is this?
        </label>
        <div className="space-y-2">
          {SHEET_TYPES.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 p-3 rounded-md border border-border hover:border-border2 cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent/5"
            >
              <input
                type="radio"
                name="sheet_type_radio"
                value={opt.value}
                checked={sheetType === opt.value}
                onChange={() => setSheetType(opt.value)}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-muted mt-0.5">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4 p-3 rounded-md bg-surface2 border border-border">
        <div className="text-xs uppercase tracking-wider text-muted">Import branch</div>
        <div className="font-medium mt-1">
          {assignedBranchName ?? 'No branch assigned'}
        </div>
        <div className="text-xs text-muted mt-1">
          Imported data is automatically assigned to your user branch.
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          file ? 'border-teal bg-teal/5' : 'border-border2 bg-surface2 hover:border-accent'
        }`}
      >
        {file ? (
          <div>
            <div className="font-mono font-medium text-teal">{file.name}</div>
            <div className="text-xs text-muted mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB · ready
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-xs text-muted hover:text-text underline mt-3"
            >
              choose a different file
            </button>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <div className="text-sm font-medium mb-1">Click to choose Excel file</div>
            <div className="text-xs text-muted">.xlsx, .xls, or .csv</div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button type="submit" disabled={isPending || !file || !assignedBranchName} className="btn btn-primary">
          {isPending ? 'Parsing file...' : 'Parse & preview →'}
        </button>
      </div>
    </form>
  )
}
