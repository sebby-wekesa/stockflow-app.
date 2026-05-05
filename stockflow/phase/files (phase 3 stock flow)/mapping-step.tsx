'use client'

import { useState, useTransition } from 'react'
import { applyMapping, cancelImport } from '../../actions'
import {
  FIELD_LABELS,
  REQUIRED_FIELDS,
  type ImportField,
  type SheetType,
} from '@/lib/import/parsers'

export function MappingStep({
  batchId,
  sheetType,
  mappingConfig,
  sampleData,
}: {
  batchId: string
  sheetType: SheetType
  mappingConfig: Record<string, ImportField>
  sampleData: Record<string, unknown>
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, ImportField>>(mappingConfig ?? {})

  const headers = Object.keys(sampleData)
  const requiredFields = REQUIRED_FIELDS[sheetType]
  const mappedFields = new Set(Object.values(mapping))
  const missingRequired = requiredFields.filter((f) => !mappedFields.has(f))

  function setField(header: string, field: ImportField) {
    setMapping((prev) => ({ ...prev, [header]: field }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (missingRequired.length > 0) {
      setError(
        `Required fields not mapped: ${missingRequired
          .map((f) => FIELD_LABELS[f])
          .join(', ')}`
      )
      return
    }
    const formData = new FormData()
    for (const [header, field] of Object.entries(mapping)) {
      formData.set(`map_${header}`, field)
    }
    startTransition(async () => {
      try {
        await applyMapping(batchId, formData)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  function handleCancel() {
    if (!confirm('Discard this import? This cannot be undone.')) return
    startTransition(async () => {
      try {
        await cancelImport(batchId)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card p-6">
        <div className="mb-4">
          <div className="font-head font-bold">Map Excel columns to system fields</div>
          <p className="text-xs text-muted mt-1">
            Auto-mapping applied based on column names. Verify each row before continuing.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="border border-border rounded-md overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-surface2 text-xs uppercase tracking-wider text-muted">
            <div className="col-span-4">Excel column</div>
            <div className="col-span-3">Sample value</div>
            <div className="col-span-4">System field</div>
            <div className="col-span-1 text-right">Status</div>
          </div>
          {headers.map((header) => {
            const field = mapping[header] ?? 'ignore'
            const sample = sampleData[header]
            const sampleStr = sample === null || sample === undefined ? '' : String(sample)
            const isRequired = field !== 'ignore' && requiredFields.includes(field)
            return (
              <div
                key={header}
                className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-border items-center"
              >
                <div className="col-span-4 font-mono text-sm">{header}</div>
                <div className="col-span-3 text-xs text-muted truncate font-mono">
                  {sampleStr.slice(0, 40) || <span className="italic">(empty)</span>}
                </div>
                <div className="col-span-4">
                  <select
                    value={field}
                    onChange={(e) => setField(header, e.target.value as ImportField)}
                    className="input text-xs py-1.5"
                  >
                    {Object.entries(FIELD_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 text-right">
                  {field === 'ignore' ? (
                    <span className="text-[10px] text-muted">—</span>
                  ) : isRequired ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">
                      required
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal/15 text-teal">
                      ok
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {missingRequired.length > 0 && (
          <div className="mt-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
            Still need to map: {missingRequired.map((f) => FIELD_LABELS[f]).join(', ')}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button type="button" onClick={handleCancel} className="btn btn-ghost text-red">
            Discard import
          </button>
          <button
            type="submit"
            disabled={isPending || missingRequired.length > 0}
            className="btn btn-primary"
          >
            {isPending ? 'Parsing rows & matching...' : 'Run matching →'}
          </button>
        </div>
      </div>
    </form>
  )
}
