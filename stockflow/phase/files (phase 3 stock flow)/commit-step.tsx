'use client'

import { useState, useTransition } from 'react'
import { approveAndCommit } from '../../actions'
import type { ImportMode } from '@prisma/client'

export function CommitStep({
  batchId,
  statusCounts,
  conflictsRemaining,
  sheetType,
  importMode,
  branchBreakdown,
}: {
  batchId: string
  statusCounts: Record<string, number>
  conflictsRemaining: number
  sheetType: string
  importMode: ImportMode
  branchBreakdown: Array<{ branch: string | null; _count: { _all: number }; _sum: { qty: number | null } }>
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ written: number; errors: string[] } | null>(null)

  const ok = statusCounts.ok ?? 0
  const skipped = statusCounts.skipped ?? 0

  const isReady = conflictsRemaining === 0 && ok > 0

  function handleCommit() {
    if (!confirm(`Commit ${ok} rows to the stock ledger? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await approveAndCommit(batchId)
        setResult(res)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div className="card p-6">
      <div className="font-head font-bold mb-4">Commit preview</div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-surface2 rounded-md p-4">
          <div className="text-xs uppercase tracking-wider text-muted">Rows to write</div>
          <div className="font-head text-2xl font-bold mt-1">{ok}</div>
        </div>
        <div className="bg-surface2 rounded-md p-4">
          <div className="text-xs uppercase tracking-wider text-muted">Skipped</div>
          <div className="font-head text-2xl font-bold text-muted mt-1">{skipped}</div>
        </div>
        <div className="bg-surface2 rounded-md p-4">
          <div className="text-xs uppercase tracking-wider text-muted">Mode</div>
          <div className="font-head text-2xl font-bold capitalize mt-1">{importMode}</div>
        </div>
      </div>

      {branchBreakdown.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wider text-muted mb-2 mt-4">
            Impact by branch
          </div>
          <div className="border border-border rounded-md overflow-hidden mb-4">
            {branchBreakdown.map((b, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 border-b border-border last:border-b-0"
              >
                <div className="flex-1 capitalize">{b.branch ?? '(unspecified)'}</div>
                <div className="text-muted text-xs flex-1">
                  {b._count._all} {b._count._all === 1 ? 'transaction' : 'transactions'}
                </div>
                <div className="text-right font-mono text-sm">
                  {(b._sum.qty ?? 0).toLocaleString()} units
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="p-3 rounded-md bg-info/10 border border-info/30 text-xs text-info mb-4">
        {sheetType === 'sales_quickbooks' ? (
          <>
            Sales import — rows will create <code>sales_out</code> stock movements (decrement) and
            corresponding sales order records grouped by invoice number.
          </>
        ) : importMode === 'replace' ? (
          <>Replace mode — existing stock will be zeroed out before new values are written.</>
        ) : (
          <>Update mode — quantities will be added to existing stock balances.</>
        )}
      </div>

      {result ? (
        <div className="p-4 rounded-md bg-teal/10 border border-teal/30">
          <div className="font-head font-bold text-teal mb-1">
            ✓ Committed successfully
          </div>
          <div className="text-sm text-muted">
            {result.written} rows written to the stock ledger.
          </div>
          {result.errors.length > 0 && (
            <pre className="mt-2 text-xs font-mono text-red whitespace-pre-wrap">
              {result.errors.slice(0, 5).join('\n')}
            </pre>
          )}
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCommit}
            disabled={isPending || !isReady}
            className="btn btn-primary"
          >
            {isPending
              ? 'Committing...'
              : !isReady
              ? `${conflictsRemaining} conflicts remaining`
              : `Commit ${ok} rows ↗`}
          </button>
        </div>
      )}
    </div>
  )
}
