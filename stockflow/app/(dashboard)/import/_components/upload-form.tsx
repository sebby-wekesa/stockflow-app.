'use client'

import { useState, useTransition } from 'react'
import { uploadImport } from '../actions'
import { SHEET_TYPE_LABELS, type SheetType } from '@/lib/import/parsers'

export function UploadForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheetType, setSheetType] = useState<SheetType>('sales_quickbooks')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError('Please choose a file')
      return
    }
    const formData = new FormData(e.currentTarget)
    formData.set('file', file)
    startTransition(async () => {
      try {
        await uploadImport(formData)
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            File type
          </label>
          <select
            name="sheet_type"
            value={sheetType}
            onChange={(e) => setSheetType(e.target.value as SheetType)}
            className="input"
          >
            {Object.entries(SHEET_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Import mode
          </label>
          <select name="import_mode" defaultValue="update" className="input">
            <option value="update">Update — add to existing (recommended)</option>
            <option value="replace">Replace — overwrite existing balances</option>
            <option value="ignore">Ignore — only import new products</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Target branch
          </label>
          <select name="branch" defaultValue="auto" className="input">
            <option value="auto">Auto — read from each row's branch column</option>
            <option value="mombasa">Mombasa only</option>
            <option value="nairobi">Nairobi only</option>
            <option value="bonje">Bonje only</option>
          </select>
          <p className="text-xs text-muted mt-1">
            For sales exports, choose Auto — the Class column tells us each transaction's branch.
          </p>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          file
            ? 'border-teal bg-teal/5'
            : 'border-border2 bg-surface2 hover:border-accent'
        }`}
      >
        {file ? (
          <div>
            <div className="font-mono font-medium text-teal">{file.name}</div>
            <div className="text-xs text-muted mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB · ready to upload
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
            <div className="text-sm font-medium mb-1">
              Click to choose Excel file
            </div>
            <div className="text-xs text-muted">.xlsx, .xls, or .csv</div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button
          type="submit"
          disabled={isPending || !file}
          className="btn btn-primary"
        >
          {isPending ? 'Uploading & parsing...' : 'Upload & continue →'}
        </button>
      </div>
    </form>
  )
}