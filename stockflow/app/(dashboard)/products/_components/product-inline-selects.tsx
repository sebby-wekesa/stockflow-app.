'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StockOrigin } from '@prisma/client'
import { updateProductOrigin, updateProductUom } from '@/actions/products'
import {
  ORIGIN_LABELS,
  PRODUCT_UOM_LABELS,
  PRODUCT_UOMS,
  normalizeProductUom,
  type ProductUom,
} from '@/lib/products'

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

type ProductUomSelectProps = {
  productId: string
  uom: string
  canEdit: boolean
  currentStock?: number
  variant?: 'code' | 'stock-label'
}

export function ProductUomSelect({
  productId,
  uom,
  canEdit,
  currentStock = 0,
  variant = 'code',
}: ProductUomSelectProps) {
  const router = useRouter()
  const initialUom = normalizeProductUom(uom) ?? 'PCS'
  const [selectedUom, setSelectedUom] = useState<ProductUom>(initialUom)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const noun = selectedUom === 'SETS'
    ? currentStock === 1 ? 'set' : 'sets'
    : currentStock === 1 ? 'piece' : 'pieces'

  if (!canEdit) {
    return variant === 'stock-label' ? (
      <span>
        {currentStock.toLocaleString()} <span className="text-muted">{noun}</span>
      </span>
    ) : (
      <span>{selectedUom}</span>
    )
  }

  function handleChange(nextUom: ProductUom) {
    const previousUom = selectedUom
    setSelectedUom(nextUom)
    setError('')

    startTransition(async () => {
      try {
        await updateProductUom(productId, nextUom)
        router.refresh()
      } catch (err) {
        setSelectedUom(previousUom)
        setError(err instanceof Error ? err.message : 'Could not update UOM')
      }
    })
  }

  return (
    <div className={variant === 'stock-label' ? 'min-w-[150px]' : 'min-w-[105px]'}>
      {variant === 'stock-label' && (
        <div className="font-mono text-sm mb-1">{currentStock.toLocaleString()}</div>
      )}
      <select
        aria-label={variant === 'stock-label' ? 'Pieces or sets' : 'Product UOM'}
        value={selectedUom}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as ProductUom)}
        className="form-input w-full py-1.5 text-xs"
      >
        {PRODUCT_UOMS.map((option) => (
          <option key={option} value={option}>
            {variant === 'stock-label' ? (option === 'SETS' ? 'sets' : 'pieces') : PRODUCT_UOM_LABELS[option]}
          </option>
        ))}
      </select>
      {error && <div className="mt-1 text-xs text-red">{error}</div>}
    </div>
  )
}
