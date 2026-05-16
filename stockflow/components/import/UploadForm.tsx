'use client'

import { useState, useTransition } from 'react'
import { uploadImport } from '@/app/(dashboard)/import/actions'
import { useRouter } from 'next/navigation'
import { SHEET_TYPE_LABELS, type SheetType } from '@/lib/import/parsers'
import { ALL_BRANCHES } from '@/lib/branches'

export function UploadForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    console.log('Form submitted, file:', file)
    setError(null)
    if (!file) {
      setError('Please choose a file')
      return
    }

    console.log('Starting upload transition')
    startTransition(async () => {
      try {
        const formData = new FormData()

        // Add file
        formData.append('file', file)

        // Add form fields manually since some inputs might not have name attributes
        const form = e.target as HTMLFormElement
        const sheetTypeSelect = form.querySelector('select[name="sheet_type"]') as HTMLSelectElement
        const importModeSelect = form.querySelector('select[name="import_mode"]') as HTMLSelectElement
        const targetBranchSelect = form.querySelector('select[name="target_branch"]') as HTMLSelectElement

        if (sheetTypeSelect) formData.append('sheet_type', sheetTypeSelect.value)
        if (importModeSelect) formData.append('import_mode', importModeSelect.value)
        if (targetBranchSelect) formData.append('target_branch', targetBranchSelect.value)

        console.log('Submitting form data:', {
          file: file.name,
          sheet_type: sheetTypeSelect?.value,
          import_mode: importModeSelect?.value,
          target_branch: targetBranchSelect?.value,
        })

        const result = await uploadImport(formData)
        if (result.success && result.batchId) {
          router.push(`/import/${result.batchId}`)
        } else {
          throw new Error(result.error || 'Upload failed')
        }
      } catch (err) {
        console.error('Upload error:', err)
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    })
  }

  return (
    <div className="card">
      <div className="section-header mb-6">
        <div className="section-title">Quick Import</div>
        <div className="section-sub">Upload Excel files for bulk data import</div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-md bg-red/15 border border-red/30 text-red text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-group">
          <label className="form-label">Excel File</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="form-input"
            disabled={isPending}
            required
          />
          <p className="text-muted text-sm mt-1">
            Upload Excel files (.xlsx, .xls) for bulk data import
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">File Type</label>
          <div className="space-y-2">
            {[
              { value: 'sales_quickbooks', label: 'QuickBooks sales export', desc: 'Sales invoices from QuickBooks' },
              { value: 'springs_stock', label: 'Springs master list', desc: 'SPRINGS LIST sheet with vehicle makes' },
              { value: 'consumables', label: 'Branch consumables stock', desc: 'Mombasa/Nairobi stock movements' },
              { value: 'auto', label: 'Auto-detect', desc: 'Automatically detect file type' },
            ].map(({ value, label, desc }) => (
              <label key={value} className="flex items-center space-x-3 p-3 border border-border rounded-md hover:bg-surface-secondary cursor-pointer">
                <input
                  type="radio"
                  name="sheet_type"
                  value={value}
                  defaultChecked={value === 'auto'}
                  disabled={isPending}
                  className="form-radio"
                />
                <div>
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-muted text-xs">{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="form-group">
            <label className="form-label">Import Mode</label>
            <select name="import_mode" defaultValue="update" className="form-input" disabled={isPending}>
              <option value="update">Update existing records</option>
              <option value="ignore">Only import new products</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Target Branch</label>
            <select name="target_branch" className="form-input" disabled={isPending}>
              <option value="">All branches</option>
              {ALL_BRANCHES.map((branch) => (
                <option key={branch} value={branch}>
                  {branch.charAt(0).toUpperCase() + branch.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !file}
            className="btn btn-primary"
          >
            {isPending ? 'Uploading...' : 'Upload & Parse'}
          </button>
        </div>
      </form>
    </div>
  )
}