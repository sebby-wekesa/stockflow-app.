'use client'

import { useState, useTransition } from 'react'
import { uploadImport } from '../actions'
import { SHEET_TYPE_LABELS, type SheetType } from '@/lib/import/parsers'
import { ALL_BRANCHES } from '@/lib/branches'

export function UploadForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError('Please choose a file')
      return
    }

    startTransition(async () => {
      try {
        const formData = new FormData(e.target as HTMLFormElement)
        formData.set('file', file)
        await uploadImport(formData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
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
          <select name="sheet_type" defaultValue="auto" className="input" disabled={isPending}>
            <option value="auto">Auto-detect</option>
            {(Object.entries(SHEET_TYPE_LABELS) as [SheetType, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Import mode
          </label>
          <select name="import_mode" defaultValue="update" className="input" disabled={isPending}>
            <option value="update">Update — update existing records</option>
            <option value="ignore">Ignore — only import new products</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Target branch
          </label>
          <select name="target_branch" defaultValue="" className="input" disabled={isPending}>
            <option value="">All branches</option>
            {ALL_BRANCHES.map((branch) => (
              <option key={branch} value={branch}>
                {branch.charAt(0).toUpperCase() + branch.slice(1)}
              </option>
            ))}
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
            <div className="text-xs text-muted">.xlsx, .xls</div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
              disabled={isPending}
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