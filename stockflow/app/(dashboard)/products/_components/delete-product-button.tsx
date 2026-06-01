'use client'

import { useState, useTransition } from 'react'
import { deleteProduct } from '@/actions/products'

type DeleteProductButtonProps = {
  productId: string
  productName: string
}

export function DeleteProductButton({
  productId,
  productName,
}: DeleteProductButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    setError(null)

    if (
      !window.confirm(
        `Delete "${productName}"? This cannot be undone. Stock movements for this product will also be deleted. Products with receipts cannot be deleted.`
      )
    ) {
      return
    }

    startTransition(async () => {
      try {
        await deleteProduct(productId)
      } catch (err) {
        setError((err as Error).message || 'Could not delete product')
      }
    })
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="btn btn-ghost btn-sm text-red disabled:opacity-50"
      >
        {isPending ? 'Deleting...' : 'Delete'}
      </button>
      {error && <div className="max-w-48 text-right text-xs text-red">{error}</div>}
    </div>
  )
}
