'use client'

import { useState, useTransition } from 'react'
import { toggleProductActive, deleteProduct } from '../actions'

export function DangerZone({
  productId,
  isActive,
  usageCount,
}: {
  productId: string
  isActive: boolean
  usageCount: number
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggleActive() {
    setError(null)
    startTransition(async () => {
      try {
        await toggleProductActive(productId)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  function handleDelete() {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await deleteProduct(productId)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div className="card p-6 border-red-500/30 bg-red-500/5">
      <div className="font-head font-bold text-red mb-3">Danger zone</div>
      <p className="text-sm text-muted mb-4">
        These actions are irreversible. Please be certain.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleToggleActive}
          disabled={isPending}
          className="btn btn-outline border-orange-500/50 text-orange hover:bg-orange-500/10"
        >
          {isPending ? 'Updating...' : isActive ? 'Deactivate product' : 'Reactivate product'}
        </button>

        {usageCount === 0 && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="btn btn-outline border-red-500/50 text-red hover:bg-red-500/10"
          >
            {isPending ? 'Deleting...' : 'Delete product'}
          </button>
        )}
      </div>

      {usageCount > 0 && (
        <p className="text-xs text-muted mt-2">
          Product has {usageCount} usage(s) in stock movements, sales, or job cards. Can only be deactivated, not deleted.
        </p>
      )}
    </div>
  )
}