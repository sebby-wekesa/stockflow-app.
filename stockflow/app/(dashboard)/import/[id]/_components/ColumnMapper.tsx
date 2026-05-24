'use client'

import { useState, useTransition } from 'react'
import { saveColumnMapping } from '../../actions'
import { FIELD_LABELS, suggestMapping, type ImportField, type SheetType } from '@/lib/import/parsers'
import type { ImportBatch, ImportRow } from '@prisma/client'

interface ColumnMapperProps {
  batch: ImportBatch & {
    ImportRow: ImportRow[]
  }
}

export function ColumnMapper({ batch }: ColumnMapperProps) {
  const [mappings, setMappings] = useState<Record<string, ImportField>>(() => {
    // Get headers from first row
    const first = batch.ImportRow[0]
    const sampleRow = (first?.raw_data as Record<string, unknown>) || {}
    if (!sampleRow || Object.keys(sampleRow).length === 0) return {}
    const headers = Object.keys(sampleRow)
    return suggestMapping(headers, batch.sheet_type as SheetType)
  })

  const [isPending, startTransition] = useTransition()

  const firstRow = batch.ImportRow[0]
  const headers = firstRow?.raw_data ? Object.keys(firstRow.raw_data as Record<string, unknown>) : []

  function handleMappingChange(header: string, field: ImportField) {
    setMappings(prev => ({ ...prev, [header]: field }))
  }

  function handleSubmit() {
    startTransition(async () => {
      await saveColumnMapping(batch.id, mappings)
    })
  }

  return (
    <div className="card p-6">
      <div className="mb-6">
        <h2 className="font-head text-xl font-bold mb-2">Map Columns</h2>
        <p className="text-muted text-sm">
          Map the columns from your Excel file to the appropriate fields. We've auto-detected mappings based on common column names.
        </p>
      </div>

      <div className="space-y-4">
        {headers.map((header) => {
          const sampleValue = (batch.ImportRow[0]?.raw_data as Record<string, unknown> | undefined)?.[header]
          const currentMapping = mappings[header] || 'ignore'

          return (
            <div key={header} className="flex items-center gap-4 p-4 bg-surface2 rounded-md">
              <div className="flex-1">
                <div className="font-medium text-sm">{header}</div>
                <div className="text-xs text-muted mt-1">
                  Sample: {String(sampleValue || '').slice(0, 50)}
                  {String(sampleValue || '').length > 50 && '…'}
                </div>
              </div>

              <div className="w-48">
                <select
                  value={currentMapping}
                  onChange={(e) => handleMappingChange(header, e.target.value as ImportField)}
                  className="input text-sm"
                  disabled={isPending}
                >
                  <option value="ignore">(ignore this column)</option>
                  {(Object.entries(FIELD_LABELS) as [ImportField, string][]).map(([field, label]) => (
                    <option key={field} value={field}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="btn btn-primary"
        >
          {isPending ? 'Processing...' : 'Run Matching'}
        </button>
      </div>
    </div>
  )
}