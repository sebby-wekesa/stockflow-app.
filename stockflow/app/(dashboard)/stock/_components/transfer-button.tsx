'use client'

import { useState, useTransition } from 'react'
import { dispatchTransfer, searchProductsWithStock } from '@/actions/stock'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/lib/branches'
import type { BranchCode as Branch } from '@/lib/branches'

type Picked = {
  id: string
  product_code: string
  canonical_name: string
  uom: string
  stock_at_branch: number | null
}

export function TransferButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        + Transfer stock
      </button>
      {open && <TransferModal onClose={() => setOpen(false)} />}
    </>
  )
}

function TransferModal({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [source, setSource] = useState<Branch>('mombasa')
  const [dest, setDest] = useState<Branch>('nairobi')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!picked) {
      setError('Please pick a product first')
      return
    }
    if (source === dest) {
      setError('Source and destination must be different')
      return
    }

    const fd = new FormData(e.currentTarget)
    fd.set('product_id', picked.id)
    fd.set('source_branch', source)
    fd.set('dest_branch', dest)

    startTransition(async () => {
      try {
        await dispatchTransfer(fd)
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
      <div className="bg-surface border border-border rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-head text-lg font-bold">Transfer stock</div>
            <div className="text-xs text-muted mt-1">
              Move finished goods between branches
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
          {/* PRODUCT PICKER */}
          <div className="mb-4">
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Product
            </label>
            {picked ? (
              <div className="bg-surface2 rounded-md p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-sm text-accent">{picked.product_code}</div>
                  <div className="text-xs text-muted truncate">{picked.canonical_name}</div>
                  <div className="text-xs text-teal mt-1 font-mono">
                    {picked.stock_at_branch ?? 0} available at {BRANCH_LABELS[source]}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="text-xs text-muted hover:text-text underline ml-2 flex-shrink-0"
                >
                  change
                </button>
              </div>
            ) : (
              <ProductPicker source={source} onPick={setPicked} />
            )}
          </div>

          {/* SOURCE & DEST */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                From
              </label>
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as Branch)
                  setPicked(null) // re-pick because available qty changes
                }}
                className="input"
              >
                {ALL_BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {BRANCH_LABELS[b]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                To
              </label>
              <select
                value={dest}
                onChange={(e) => setDest(e.target.value as Branch)}
                className="input"
              >
                {ALL_BRANCHES.filter((b) => b !== source).map((b) => (
                  <option key={b} value={b}>
                    {BRANCH_LABELS[b]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* QUANTITY & NOTES */}
          <div className="mb-4">
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Quantity
            </label>
            <input
              name="qty"
              type="number"
              min="1"
              max={picked?.stock_at_branch ?? undefined}
              required
              className="input font-mono"
              placeholder="pcs"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Notes (optional)
            </label>
            <input
              name="notes"
              className="input"
              placeholder="Reason or transport reference"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !picked}
              className="btn btn-primary"
            >
              {isPending ? 'Dispatching...' : 'Dispatch transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProductPicker({
  source,
  onPick,
}: {
  source: Branch
  onPick: (p: Picked) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Picked[]>([])
  const [searching, setSearching] = useState(false)

  async function handleSearch(value: string) {
    setQuery(value)
    if (value.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const found = await searchProductsWithStock(value, source)
      setResults(found.filter((p) => (p.stock_at_branch ?? 0) > 0) as Picked[])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="bg-surface2 rounded-md p-3 border border-border">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search by code or name..."
        className="input text-sm mb-2"
      />
      <div className="max-h-48 overflow-y-auto">
        {searching ? (
          <div className="text-xs text-muted px-2 py-2">Searching...</div>
        ) : query.length < 2 ? (
          <div className="text-xs text-muted px-2 py-2">
            Type at least 2 characters to search...
          </div>
        ) : results.length === 0 ? (
          <div className="text-xs text-muted px-2 py-2">
            No products with stock at {BRANCH_LABELS[source]}
          </div>
        ) : (
          results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r)}
              className="w-full text-left px-2 py-2 rounded-md hover:bg-bg text-xs flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="font-mono text-accent">{r.product_code}</div>
                <div className="text-muted truncate">{r.canonical_name}</div>
              </div>
              <div className="font-mono text-teal flex-shrink-0 ml-2">
                {r.stock_at_branch}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}