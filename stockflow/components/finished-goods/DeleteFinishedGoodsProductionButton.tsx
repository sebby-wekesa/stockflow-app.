'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteFinishedGoodsProduction } from '@/app/actions/finished-goods'

export default function DeleteFinishedGoodsProductionButton({
  logId,
  jobCardNo,
}: {
  logId: string
  jobCardNo: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!window.confirm(`Delete production record ${jobCardNo}? This will remove its stock from inventory and cannot be undone.`)) {
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await deleteFinishedGoodsProduction(logId)
        router.refresh()
      } catch (err) {
        setError((err as Error).message || 'Could not delete production record')
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
