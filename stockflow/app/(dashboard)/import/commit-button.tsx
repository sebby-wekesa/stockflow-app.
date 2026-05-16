'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { commitSpecializedBatch } from './actions'
import type { CommitResult } from '@/lib/import/specialized-commit'

export function CommitButton({
  batchId,
  rowCount,
  sheetType,
}: {
  batchId: string
  rowCount: number
  sheetType: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CommitResult | null>(null)

  const isMaster = sheetType === 'springs_master' || sheetType === 'ubolt_master'
  const isSales = sheetType === 'sales_quickbooks_v2'

  function handleCommit() {
    const msg = isMaster
      ? `Create or update ${rowCount} products in the master catalogue?`
      : isSales
      ? `Import ${rowCount} sales line items? This will create invoices and decrement stock.`
      : `Apply ${rowCount} stock movements?`
    if (!confirm(msg)) return

    setError(null)
    startTransition(async () => {
      try {
        const res = await commitSpecializedBatch(batchId)
        setResult(res)
        router.refresh()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  if (result) {
    return (
      <div className="card p-5 border-teal/30 bg-teal/5">
        <div className="font-head font-bold text-teal mb-2">✓ Committed</div>
        <div className="text-sm space-y-1">
          <div>
            <span className="text-muted">Written:</span>{' '}
            <span className="font-mono font-medium">{result.written}</span>
          </div>
          <div>
            <span className="text-muted">Skipped:</span>{' '}
            <span className="font-mono font-medium">{result.skipped}</span>
          </div>
          {result.errors.length > 0 && (
            <div>
              <span className="text-muted">Errors:</span>{' '}
              <span className="font-mono font-medium text-red">{result.errors.length}</span>
            </div>
          )}
        </div>

        {result.unmatchedNames && result.unmatchedNames.length > 0 && (
          <details className="mt-4">
            <summary className="text-xs text-muted cursor-pointer hover:text-text">
              {result.unmatchedNames.length} product names couldn't be matched — click to view
            </summary>
            <div className="mt-3 bg-bg p-3 rounded-md max-h-64 overflow-y-auto">
              <p className="text-xs text-muted mb-2">
                Add these as aliases on the relevant products, or create new products, then
                re-import.
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left pb-1">Raw name</th>
                    <th className="text-right pb-1">Rows</th>
                    <th className="text-right pb-1">Total qty</th>
                  </tr>
                </thead>
                <tbody>
                  {result.unmatchedNames.slice(0, 50).map((u, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1 font-mono truncate max-w-md">{u.raw_name}</td>
                      <td className="py-1 text-right font-mono">{u.rows.length}</td>
                      <td className="py-1 text-right font-mono">{u.total_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.unmatchedNames.length > 50 && (
                <p className="text-xs text-muted mt-2">
                  ...and {result.unmatchedNames.length - 50} more
                </p>
              )}
            </div>
          </details>
        )}
      </div>
    )
  }

  return (
    <div className="card p-5">
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-head font-bold text-sm mb-1">Ready to commit</div>
          <p className="text-xs text-muted">
            {isMaster
              ? 'Will upsert products by code — existing entries get updated, new ones get created.'
              : isSales
              ? 'Will create invoices grouped by invoice number, decrement stock per line.'
              : 'Will apply stock-in and stock-out movements to branch balances.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCommit}
          disabled={isPending}
          className="btn btn-primary"
        >
          {isPending ? 'Committing...' : `Commit ${rowCount} rows ↗`}
        </button>
      </div>
    </div>
  )
}