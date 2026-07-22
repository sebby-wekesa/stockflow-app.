'use client'

import { useState, useTransition } from 'react'
import { dispatchTransfer } from '@/actions/stock'
import { BRANCH_LABELS } from '@/lib/branches'
import type { BranchCode as Branch } from '@/lib/branches'

type ProductWithStock = {
  id: string
  product_code: string
  canonical_name: string
  uom: string
  stock_levels: Array<{ branch: Branch; qty: number; pieces_sets: number }>
}

type TransferQuantityUnit = 'KG' | 'PCS_SETS'

type PickedProduct = {
  id: string
  product_code: string
  canonical_name: string
  uom: string
  available_kg: number
  available_pieces_sets: number
  quantity_unit: TransferQuantityUnit
}

function quantityUnitLabel(unit: TransferQuantityUnit) {
  return unit === 'KG' ? 'KG' : 'PCS/Sets'
}

export function TransferForm({
  products,
  userBranches,
  sourceBranches,
  initialSourceBranch,
}: {
  products: ProductWithStock[]
  userBranches: Branch[]
  sourceBranches: Branch[]
  initialSourceBranch?: Branch
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [picked, setPicked] = useState<PickedProduct | null>(null)
  const [productQuery, setProductQuery] = useState('')
  const firstSourceBranch = initialSourceBranch ?? sourceBranches[0] ?? 'mombasa'
  const [sourceBranch, setSourceBranch] = useState<Branch>(firstSourceBranch)
  const [destBranch, setDestBranch] = useState<Branch>(
    () => userBranches.find((branch) => branch !== firstSourceBranch) ?? firstSourceBranch
  )
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

    const transferQty = Number(qty)
    if (!Number.isFinite(transferQty) || transferQty <= 0) {
      setError('Please enter a valid quantity')
      return
    }

    const availableQty = picked.quantity_unit === 'KG'
      ? picked.available_kg
      : picked.available_pieces_sets
    const unitLabel = quantityUnitLabel(picked.quantity_unit)
    if (transferQty > availableQty) {
      setError(`Cannot transfer ${transferQty} ${unitLabel} - only ${availableQty} available`)
      return
    }

    const fd = new FormData()
    fd.set('product_id', picked.id)
    fd.set('source_branch', sourceBranch)
    fd.set('dest_branch', destBranch)
    fd.set('qty', qty)
    fd.set('quantity_unit', picked.quantity_unit)
    fd.set('notes', notes)

    startTransition(async () => {
      try {
        await dispatchTransfer(fd)
        setSuccess(`Successfully transferred ${qty} ${unitLabel} from ${sourceBranch} to ${destBranch}`)
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
    const branchStock = product.stock_levels.find(s => s.branch === branch)
    const availableKg = branchStock?.qty ?? 0
    const availablePiecesSets = branchStock?.pieces_sets ?? 0
    setPicked({
      id: product.id,
      product_code: product.product_code,
      canonical_name: product.canonical_name,
      uom: product.uom,
      available_kg: availableKg,
      available_pieces_sets: availablePiecesSets,
      quantity_unit: availableKg > 0 ? 'KG' : 'PCS_SETS',
    })
  }

  const availableDestinations = userBranches.filter(b => b !== sourceBranch)
  const branchProducts = products.filter((product) =>
    product.stock_levels.some((stock) => stock.branch === sourceBranch)
  )
  const normalizedProductQuery = productQuery.trim().toLowerCase()
  const filteredProducts = normalizedProductQuery
    ? branchProducts.filter((product) =>
        product.product_code.toLowerCase().includes(normalizedProductQuery) ||
        product.canonical_name.toLowerCase().includes(normalizedProductQuery)
      )
    : branchProducts

  return (
    <div className="stock-transfer-form">
      {error && (
        <div className="stock-transfer-alert stock-transfer-alert-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="stock-transfer-alert stock-transfer-alert-success" role="status">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="stock-transfer-form-body">
        <div className="stock-transfer-route-fields">
          <div className="form-group">
            <label className="form-label" htmlFor="transfer-source-branch">
              From branch <span className="stock-transfer-required" aria-hidden="true">*</span>
            </label>
            <select
              id="transfer-source-branch"
              value={sourceBranch}
              onChange={(e) => {
                const nextSourceBranch = e.target.value as Branch
                setSourceBranch(nextSourceBranch)
                setPicked(null)
                setProductQuery('')
                if (destBranch === nextSourceBranch) {
                  setDestBranch(userBranches.find((branch) => branch !== nextSourceBranch) ?? nextSourceBranch)
                }
              }}
              className="form-input stock-transfer-input"
            >
              {sourceBranches.map((branch) => (
                <option key={branch} value={branch}>
                  {BRANCH_LABELS[branch]}
                </option>
              ))}
            </select>
          </div>

          <div className="stock-transfer-route-arrow" aria-hidden="true">→</div>

          <div className="form-group">
            <label className="form-label" htmlFor="transfer-destination-branch">
              To branch <span className="stock-transfer-required" aria-hidden="true">*</span>
            </label>
            <select
              id="transfer-destination-branch"
              value={destBranch}
              onChange={(e) => setDestBranch(e.target.value as Branch)}
              className="form-input stock-transfer-input"
            >
              {availableDestinations.map((branch) => (
                <option key={branch} value={branch}>
                  {BRANCH_LABELS[branch]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PRODUCT PICKER */}
        <div className="form-group stock-transfer-field">
          <label className="form-label">
            Product <span className="stock-transfer-required" aria-hidden="true">*</span>
          </label>
          {picked ? (
            <div className="stock-transfer-selected-product">
              <div className="min-w-0">
                <div className="stock-transfer-product-code">{picked.product_code}</div>
                <div className="stock-transfer-product-name">{picked.canonical_name}</div>
                <div className="stock-transfer-product-availability">
                  {picked.available_kg} KG · {picked.available_pieces_sets} PCS/Sets available at {BRANCH_LABELS[sourceBranch]}
                </div>
                <div className="stock-transfer-unit-picker">
                  <label className="stock-transfer-product-search-label" htmlFor="transfer-quantity-unit">
                    Transfer unit
                  </label>
                  <select
                    id="transfer-quantity-unit"
                    value={picked.quantity_unit}
                    onChange={(e) => {
                      setPicked({ ...picked, quantity_unit: e.target.value as TransferQuantityUnit })
                      setQty('')
                    }}
                    className="form-input stock-transfer-input"
                  >
                    <option value="KG" disabled={picked.available_kg <= 0}>KG</option>
                    <option value="PCS_SETS" disabled={picked.available_pieces_sets <= 0}>PCS/Sets</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="btn btn-ghost btn-sm stock-transfer-change"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="stock-transfer-product-picker">
              {branchProducts.length > 0 && (
                <>
                  <label className="stock-transfer-product-search-label" htmlFor="transfer-product-search">
                    Search products
                  </label>
                  <input
                    id="transfer-product-search"
                    type="search"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    className="form-input stock-transfer-product-search"
                    placeholder="Search by SKU or product name"
                    autoComplete="off"
                  />
                </>
              )}
              <div id="transfer-product-list" className="stock-transfer-product-list">
                {filteredProducts.map((product) => {
                  const branchStock = product.stock_levels.find((stock) => stock.branch === sourceBranch)
                  const stockAtBranch = branchStock?.qty ?? 0
                  const piecesSetsAtBranch = branchStock?.pieces_sets ?? 0
                  const hasTransferableStock = stockAtBranch > 0 || piecesSetsAtBranch > 0
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => pickProduct(product, sourceBranch)}
                      className="stock-transfer-product-option"
                      disabled={!hasTransferableStock}
                      title={!hasTransferableStock ? 'No stock available at this branch' : undefined}
                    >
                      <div>
                        <div className="stock-transfer-product-code">{product.product_code}</div>
                        <div className="stock-transfer-product-name">{product.canonical_name}</div>
                      </div>
                      <div className="stock-transfer-product-quantity">
                        {stockAtBranch} KG · {piecesSetsAtBranch} PCS/Sets
                      </div>
                    </button>
                  )
                })}
              </div>
              {branchProducts.length === 0 && (
                <div className="stock-transfer-empty-products">
                  No products assigned to {BRANCH_LABELS[sourceBranch]}
                </div>
              )}
              {branchProducts.length > 0 && filteredProducts.length === 0 && (
                <div className="stock-transfer-empty-products">
                  No products match “{productQuery}”.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="stock-transfer-form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="transfer-quantity">
              Quantity to transfer{picked ? ` (${quantityUnitLabel(picked.quantity_unit)})` : ''}{' '}
              <span className="stock-transfer-required" aria-hidden="true">*</span>
            </label>
            <input
              id="transfer-quantity"
              type="number"
              min="0.01"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="form-input stock-transfer-input stock-transfer-quantity-input"
              placeholder={picked ? `Enter ${quantityUnitLabel(picked.quantity_unit)} quantity` : 'Enter quantity'}
              disabled={!picked}
            />
            {picked && (
              <div className="stock-transfer-help">
                Maximum: {picked.quantity_unit === 'KG' ? picked.available_kg : picked.available_pieces_sets}{' '}
                {quantityUnitLabel(picked.quantity_unit)}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="transfer-notes">Notes <span className="stock-transfer-optional">Optional</span></label>
            <textarea
              id="transfer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="form-input stock-transfer-input stock-transfer-notes"
              rows={3}
              placeholder="Reason for transfer or transport reference"
            />
          </div>
        </div>

        <div className="stock-transfer-form-actions">
          <div className="stock-transfer-action-copy">
            <span className="stock-transfer-action-label">Ready to dispatch?</span>
            <span>Both branch movements will be logged together.</span>
          </div>
          <button
            type="submit"
            disabled={isPending || !picked || !qty}
            className="btn btn-primary"
          >
            {isPending ? 'Transferring…' : 'Transfer stock'}
          </button>
        </div>
      </form>
    </div>
  )
}
