'use client'

import { useState, useTransition } from 'react'
import { adjustStock } from '@/app/actions/stock'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/lib/branches'
import type { BranchEnum } from '@prisma/client'

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
  const [branch, setBranch] = useState<BranchEnum>('mombasa')
  const [newQty, setNewQty] = useState('')
  const [reason, setReason] = useState('')

  const currentQty = stockByBranch[branch] ?? 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const qty = parseInt(newQty)
    if (isNaN(qty) || qty < 0) {
      setError('Invalid quantity')
      return
    }

    startTransition(async () => {
      try {
        await adjustStock(new FormData(e.target as HTMLFormElement))
        onClose()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Adjust Stock</h3>
        {error && <div className="text-red-400 mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="productId" value={productId} />
          <div className="mb-4">
            <label className="block text-sm mb-2">Branch</label>
            <select
              name="branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value as BranchEnum)}
              className="w-full p-2 border rounded"
            >
              {ALL_BRANCHES.map(b => (
                <option key={b} value={b}>{BRANCH_LABELS[b]}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-2">Current Quantity</label>
            <input
              type="number"
              value={currentQty}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-2">New Quantity</label>
            <input
              type="number"
              name="newQty"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              min="0"
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-2">Reason</label>
            <textarea
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={500}
              required
              className="w-full p-2 border rounded"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost flex-1"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={isPending}
            >
              {isPending ? 'Adjusting...' : 'Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}