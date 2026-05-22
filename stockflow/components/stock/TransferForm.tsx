'use client'

import { useState, useTransition } from 'react'
import { dispatchTransfer, searchProductsWithStock } from '@/actions/stock'
import { BRANCH_LABELS } from '@/lib/branches'
import { formatKES } from '@/lib/sales-utils'
import type { BranchCode as Branch } from '@/lib/branches'

type ProductWithStock = {
  id: string
  product_code: string
  canonical_name: string
  uom: string
  stock_levels: Array<{ branch: Branch; qty: number }>
}

type PickedProduct = {
  id: string
  product_code: string
  canonical_name: string
  uom: string
  stock_at_branch: number
}

export function TransferForm({
  products,
  userBranches,
}: {
  products: ProductWithStock[]
  userBranches: Branch[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [picked, setPicked] = useState<PickedProduct | null>(null)
  const [sourceBranch, setSourceBranch] = useState<Branch>('mombasa')
  const [destBranch, setDestBranch] = useState<Branch>('nairobi')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!picked) {
      setError('Please select a product')
      return
    }

    if (sourceBranch === destBranch) {
      setError('Source and destination branches must be different')
      return
    }

    const transferQty = parseInt(qty)
    if (!transferQty || transferQty <= 0) {
      setError('Please enter a valid quantity')
      return
    }

    if (transferQty > picked.stock_at_branch) {
      setError(`Cannot transfer ${transferQty} units - only ${picked.stock_at_branch} available`)
      return
    }

    const fd = new FormData()
    fd.set('product_id', picked.id)
    fd.set('source_branch', sourceBranch)
    fd.set('dest_branch', destBranch)
    fd.set('qty', qty)
    fd.set('notes', notes)

    startTransition(async () => {
      try {
        await dispatchTransfer(fd)
        setSuccess(`Successfully transferred ${qty} units from ${sourceBranch} to ${destBranch}`)
        // Reset form
        setPicked(null)
        setQty('')
        setNotes('')
        setError(null)

        // Clear success after a few seconds
        setTimeout(() => setSuccess(null), 4000)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  function pickProduct(product: ProductWithStock, branch: Branch) {
    const stockAtBranch = product.stock_levels.find(s => s.branch === branch)?.qty ?? 0
    setPicked({
      id: product.id,
      product_code: product.product_code,
      canonical_name: product.canonical_name,
      uom: product.uom,
      stock_at_branch: stockAtBranch,
    })
  }

  const availableDestinations = userBranches.filter(b => b !== sourceBranch)

  return (
    <div className="card p-6">
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* SOURCE BRANCH */}
        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            From branch <span className="text-red">*</span>
          </label>
          <select
            value={sourceBranch}
            onChange={(e) => {
              setSourceBranch(e.target.value as Branch)
              setPicked(null) // Reset picked product when branch changes
            }}
            className="input"
          >
            {userBranches.map((branch) => (
              <option key={branch} value={branch}>
                {BRANCH_LABELS[branch]}
              </option>
            ))}
          </select>
        </div>

        {/* DESTINATION BRANCH */}
        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            To branch <span className="text-red">*</span>
          </label>
          <select
            value={destBranch}
            onChange={(e) => setDestBranch(e.target.value as Branch)}
            className="input"
          >
            {availableDestinations.map((branch) => (
              <option key={branch} value={branch}>
                {BRANCH_LABELS[branch]}
              </option>
            ))}
          </select>
        </div>

        {/* PRODUCT PICKER */}
        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Product <span className="text-red">*</span>
          </label>
          {picked ? (
            <div className="bg-surface2 rounded-md p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-mono text-accent">{picked.product_code}</div>
                <div className="text-xs text-muted truncate">{picked.canonical_name}</div>
                <div className="text-[10px] text-muted mt-1">
                  {picked.stock_at_branch} {picked.uom} available at {BRANCH_LABELS[sourceBranch]}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-muted hover:text-red text-lg ml-2"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {products
                .filter(p => p.stock_levels.some(s => s.branch === sourceBranch && s.qty > 0))
                .map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => pickProduct(product, sourceBranch)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-surface2 border border-border transition-colors"
                  >
                    <div className="font-mono text-accent">{product.product_code}</div>
                    <div className="text-xs text-muted truncate">{product.canonical_name}</div>
                    <div className="text-[10px] text-muted mt-1">
                      {product.stock_levels.find(s => s.branch === sourceBranch)?.qty ?? 0} {product.uom} available
                    </div>
                  </button>
                ))}
              {products.filter(p => p.stock_levels.some(s => s.branch === sourceBranch && s.qty > 0)).length === 0 && (
                <div className="text-xs text-muted px-3 py-2">
                  No products with stock at {BRANCH_LABELS[sourceBranch]}
                </div>
              )}
            </div>
          )}
        </div>

        {/* QUANTITY */}
        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Quantity to transfer <span className="text-red">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="input font-mono"
            placeholder="Enter quantity"
            disabled={!picked}
          />
          {picked && (
            <div className="text-xs text-muted mt-1">
              Maximum: {picked.stock_at_branch} {picked.uom}
            </div>
          )}
        </div>

        {/* NOTES */}
        <div className="mb-6">
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input"
            rows={3}
            placeholder="Reason for transfer, vehicle details, etc."
          />
        </div>

        {/* SUBMIT */}
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={isPending || !picked || !qty}
            className="btn btn-primary"
          >
            {isPending ? 'Transferring...' : 'Transfer stock'}
          </button>
        </div>
      </form>
    </div>
  )
}