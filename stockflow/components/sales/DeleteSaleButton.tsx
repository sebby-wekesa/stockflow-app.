'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { SaleStatus } from '@prisma/client'
import { deleteSaleOrder } from '@/actions/sales'

export default function DeleteSaleButton({
  orderId,
  customerName,
  status,
}: {
  orderId: string
  customerName: string
  status: SaleStatus
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!window.confirm(`Delete sale ${orderId} for ${customerName}? This cannot be undone.`)) return

    setError(null)
    startTransition(async () => {
      try {
        await deleteSaleOrder(orderId)
        router.refresh()
      } catch (err) {
        setError((err as Error).message || 'Could not delete sale')
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
        title={status === 'CONFIRMED' ? 'Reserved stock will be returned before deletion' : 'Delete sale'}
      >
        {isPending ? 'Deleting...' : 'Delete'}
      </button>
      {error && <div className="max-w-56 text-right text-xs text-red">{error}</div>}
    </div>
  )
}
