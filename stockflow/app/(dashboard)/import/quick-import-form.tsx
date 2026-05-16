'use client'

import { useState, useTransition } from 'react'
import { uploadSpecialized } from './actions'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/lib/branches'
import type { BranchCode as Branch } from '@/lib/branches'

type SheetTypeOption = {
  value: string
  label: string
  description: string
  needsBranch: boolean
}

const SHEET_TYPES: SheetTypeOption[] = [
  {
    value: 'sales_quickbooks_v2',
    label: 'QuickBooks sales export',
    description:
      'The "SALES_JAN-APR.xlsx" style file with scattered columns and product group headers.',
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
      'A Mombasa or Nairobi stocks file with IN-OUT sheets. Imports stock movements.',
    needsBranch: true,
  },
]

export function QuickImportForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheetType, setSheetType] = useState<string>('sales_quickbooks_v2')
  const [branch, setBranch] = useState<Branch>('mombasa')

  const selected = SHEET_TYPES.find((t) => t.value === sheetType)!

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setError(null)
    // Try to auto-pick the sheet type based on the filename
    if (f) {
      const lower = f.name.toLowerCase()
      if (lower.includes('sales')) setSheetType('sales_quickbooks_v2')
      else if (lower.includes('mombasa') || lower.includes('nairobi') || lower.includes('bonje'))
        setSheetType('consumables_stock')
      else if (lower.includes('spring')) setSheetType('springs_master')
    }
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
    if (selected.needsBranch) fd.set('branch', branch)
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

      {selected.needsBranch && (
        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Which branch?
          </label>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value as Branch)}
            className="input"
          >
            {ALL_BRANCHES.map((b) => (
              <option key={b} value={b}>
                {BRANCH_LABELS[b]}
              </option>
            ))}
          </select>
        </div>
      )}

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
        <button type="submit" disabled={isPending || !file} className="btn btn-primary">
          {isPending ? 'Parsing file...' : 'Parse & preview →'}
        </button>
      </div>
    </form>
  )
}