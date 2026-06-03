'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StockOrigin } from '@prisma/client'
import { updateProductOrigin } from '@/actions/products'
import { ORIGIN_LABELS } from '@/lib/products'

type ProductOriginSelectProps = {
  productId: string
  origin: StockOrigin
  canEdit: boolean
}

export function ProductOriginSelect({ productId, origin, canEdit }: ProductOriginSelectProps) {
  const router = useRouter()
  const [selectedOrigin, setSelectedOrigin] = useState<StockOrigin>(origin)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!canEdit) {
    return <span>{ORIGIN_LABELS[origin] ?? origin}</span>
  }

  function handleChange(nextOrigin: StockOrigin) {
    const previousOrigin = selectedOrigin
    setSelectedOrigin(nextOrigin)
    setError('')

    startTransition(async () => {
      try {
        await updateProductOrigin(productId, nextOrigin)
        router.refresh()
      } catch (err) {
        setSelectedOrigin(previousOrigin)
        setError(err instanceof Error ? err.message : 'Could not update origin')
      }
    })
  }

  return (
    <div className="min-w-[150px]">
      <select
        aria-label="Product origin"
        value={selectedOrigin}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as StockOrigin)}
        className="form-input w-full py-1.5 text-xs"
      >
        {Object.entries(ORIGIN_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {error && <div className="mt-1 text-xs text-red">{error}</div>}
    </div>
  )
}
