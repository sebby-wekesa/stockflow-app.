'use client'

import { useState, useTransition } from 'react'
import { adjustStock } from '@/app/(dashboard)/stock/actions'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/lib/branches'
import type { Branch } from '@prisma/client'

export function AdjustStockButton({
  productId,
  stockByBranch,
}: {
  productId: string
  stockByBranch: Record<string, number>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn btn-ghost btn-sm"
      >
        Adjust stock
      </button>
      {open && (
        <AdjustStockModal
          productId={productId}
          stockByBranch={stockByBranch}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function AdjustStockModal({
  productId,
  stockByBranch,
  onClose,
}: {
  productId: string
  stockByBranch: Record<string, number>
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [branch, setBranch] = useState<Branch>('mombasa')

  const currentQty = stockByBranch[branch] ?? 0

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('product_id', productId)
    fd.set('branch', branch)
    startTransition(async () => {
      try {
        await adjustStock(fd)
        onClose()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-head text-lg font-bold">Adjust stock</div>
            <div className="text-xs text-muted mt-1">
              Manual correction with mandatory reason
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-text text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Branch
            </label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value as Branch)}
              className="input"
            >
              {ALL_BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {BRANCH_LABELS[b]} (currently {stockByBranch[b] ?? 0})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                Current
              </label>
              <input
                value={currentQty}
                disabled
                className="input font-mono text-muted bg-surface2"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                New quantity
              </label>
              <input
                name="new_qty"
                type="number"
                min="0"
                required
                className="input font-mono"
                placeholder="0"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Reason <span className="text-red">*</span>
            </label>
            <input
              name="reason"
              required
              minLength={3}
              maxLength={500}
              className="input"
              placeholder="e.g. Stock count correction · damage write-off · found in storeroom"
            />
            <p className="text-xs text-muted mt-1">
              This reason is logged permanently in the audit trail.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary">
              {isPending ? 'Adjusting...' : 'Save adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
