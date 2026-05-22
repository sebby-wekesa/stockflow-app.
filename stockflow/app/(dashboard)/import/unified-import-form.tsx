'use client'

import { useState, useTransition } from 'react'
import { runUnifiedImport } from './actions'

type UnifiedImportResult = {
  location: 'Mombasa' | 'Nairobi'
  parsedCounts: { products: number; sales: number; purchases: number }
  prisma: { productsUpserted: number; salesInserted: number; purchasesInserted: number; errors: string[] }
  supabase: { productsUpserted: number; salesInserted: number; purchasesInserted: number; errors: string[] }
}

export function UnifiedImportForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UnifiedImportResult | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [location, setLocation] = useState<'auto' | 'Mombasa' | 'Nairobi'>('auto')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!file) {
      setError('Please choose a file')
      return
    }

    const fd = new FormData(e.currentTarget)
    fd.set('file', file)
    fd.set('location', location)

    startTransition(async () => {
      try {
        const res = (await runUnifiedImport(fd) as unknown) as UnifiedImportResult
        setResult(res)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 mb-10">
      <div className="section-header mb-6">
        <div>
          <div className="section-title">Unified Import (Mombasa / Nairobi)</div>
          <div className="section-sub">
            Auto-detects QuickBooks ledger vs stock matrices, normalizes item names to UPPERCASE,
            and tags every row with a location.
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mb-4 p-3 rounded-md bg-teal/10 border border-teal/30 text-teal text-sm">
          Imported for <span className="font-mono">{result.location}</span> · Parsed{' '}
          <span className="font-mono">{result.parsedCounts.products}</span> products,{' '}
          <span className="font-mono">{result.parsedCounts.sales}</span> sales,{' '}
          <span className="font-mono">{result.parsedCounts.purchases}</span> purchases.
          {(result.prisma.errors.length > 0 || result.supabase.errors.length > 0) && (
            <div className="mt-2 text-xs text-muted whitespace-pre-wrap">
              {[
                ...result.prisma.errors.map((e) => `Prisma: ${e}`),
                ...result.supabase.errors.map((e) => `Supabase: ${e}`),
              ].join('\n')}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Location tagging
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value as any)}
            className="input"
            disabled={isPending}
          >
            <option value="auto">Auto (from filename)</option>
            <option value="Mombasa">Mombasa</option>
            <option value="Nairobi">Nairobi</option>
          </select>
          <p className="text-xs text-muted mt-1">
            If you pick Auto, the filename must contain “Nairobi” for Nairobi files (otherwise defaults to Mombasa).
          </p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Excel file
          </label>
          <label className="cursor-pointer block border-2 border-dashed rounded-lg p-4 text-center border-border2 bg-surface2 hover:border-accent transition-colors">
            {file ? (
              <div>
                <div className="font-mono font-medium text-teal">{file.name}</div>
                <div className="text-xs text-muted mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · ready
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-medium mb-1">Click to choose Excel file</div>
                <div className="text-xs text-muted">.xlsx, .xls</div>
              </div>
            )}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
              disabled={isPending}
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending || !file} className="btn btn-primary">
          {isPending ? 'Importing…' : 'Import now →'}
        </button>
      </div>
    </form>
  )
}

