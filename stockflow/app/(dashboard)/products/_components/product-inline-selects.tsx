'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StockOrigin } from '@prisma/client'
import {
  updateProductBranch,
  updateProductCurrentStock,
  updateProductOrigin,
  updateProductPiecesSets,
} from '@/actions/products'
import { ORIGIN_LABELS } from '@/lib/products'
import { ALL_BRANCHES, BRANCH_LABELS, type BranchCode } from '@/lib/branches'

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

type ProductBranchSelectProps = {
  productId: string
  branch: BranchCode | null
  branchLabel: string
  canEdit: boolean
}

export function ProductBranchSelect({
  productId,
  branch,
  branchLabel,
  canEdit,
}: ProductBranchSelectProps) {
  const router = useRouter()
  const [selectedBranch, setSelectedBranch] = useState<BranchCode | ''>(branch ?? '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!canEdit) {
    return <span>{branchLabel}</span>
  }

  function handleChange(nextBranch: BranchCode) {
    const previousBranch = selectedBranch
    setSelectedBranch(nextBranch)
    setError('')

    startTransition(async () => {
      try {
        await updateProductBranch(productId, nextBranch)
        router.refresh()
      } catch (err) {
        setSelectedBranch(previousBranch)
        setError(err instanceof Error ? err.message : 'Could not update branch')
      }
    })
  }

  return (
    <div className="min-w-[140px]">
      <select
        aria-label="Product branch"
        value={selectedBranch}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as BranchCode)}
        className="form-input w-full py-1.5 text-xs"
      >
        <option value="" disabled>Assign branch</option>
        {ALL_BRANCHES.map((option) => (
          <option key={option} value={option}>
            {BRANCH_LABELS[option]}
          </option>
        ))}
      </select>
      {error && <div className="mt-1 text-xs text-red">{error}</div>}
    </div>
  )
}

type ProductPiecesSetsInputProps = {
  productId: string
  piecesSets: number
  canEdit: boolean
}

export function ProductPiecesSetsInput({
  productId,
  piecesSets,
  canEdit,
}: ProductPiecesSetsInputProps) {
  const router = useRouter()
  const [value, setValue] = useState(String(piecesSets ?? 0))
  const [lastSavedValue, setLastSavedValue] = useState(String(piecesSets ?? 0))
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!canEdit) {
    return <span className="font-mono text-sm">{Number(piecesSets ?? 0).toLocaleString()}</span>
  }

  function save(nextValue = value) {
    const parsed = Number(nextValue)
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Whole number only')
      setValue(lastSavedValue)
      return
    }
    if (String(parsed) === lastSavedValue) return

    setError('')
    startTransition(async () => {
      try {
        await updateProductPiecesSets(productId, parsed)
        setLastSavedValue(String(parsed))
        setValue(String(parsed))
        router.refresh()
      } catch (err) {
        setValue(lastSavedValue)
        setError(err instanceof Error ? err.message : 'Could not update PCS/Sets')
      }
    })
  }

  return (
    <div className="min-w-[86px]">
      <input
        aria-label="PCS/Sets"
        type="number"
        min="0"
        step="1"
        value={value}
        disabled={isPending}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => save()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }
        }}
        className="form-input w-full py-1.5 text-xs font-mono"
      />
      {error && <div className="mt-1 text-xs text-red">{error}</div>}
    </div>
  )
}

type ProductCurrentStockInputProps = {
  productId: string
  currentStock: number
  canEdit: boolean
}

export function ProductCurrentStockInput({
  productId,
  currentStock,
  canEdit,
}: ProductCurrentStockInputProps) {
  const router = useRouter()
  const initialValue = String(Number(currentStock ?? 0))
  const [value, setValue] = useState(initialValue)
  const [lastSavedValue, setLastSavedValue] = useState(initialValue)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!canEdit) {
    return (
      <span className="font-mono text-sm">
        {Number(currentStock ?? 0).toLocaleString()} <span className="text-muted">kg</span>
      </span>
    )
  }

  function save(nextValue = value) {
    const parsed = Number(nextValue)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Zero or greater')
      setValue(lastSavedValue)
      return
    }
    if (parsed === Number(lastSavedValue)) return

    const normalized = String(parsed)
    setError('')
    startTransition(async () => {
      try {
        await updateProductCurrentStock(productId, parsed)
        setLastSavedValue(normalized)
        setValue(normalized)
        router.refresh()
      } catch (err) {
        setValue(lastSavedValue)
        setError(err instanceof Error ? err.message : 'Could not update stock')
      }
    })
  }

  return (
    <div className="min-w-[104px]">
      <div className="flex items-center gap-1">
        <input
          aria-label="Current stock"
          type="number"
          min="0"
          step="0.01"
          value={value}
          disabled={isPending}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => save()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          className="form-input w-full py-1.5 text-xs font-mono"
        />
        <span className="text-muted text-xs">kg</span>
      </div>
      {error && <div className="mt-1 text-xs text-red">{error}</div>}
    </div>
  )
}
