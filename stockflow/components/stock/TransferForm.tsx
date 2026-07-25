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

type TransferLine = PickedProduct & { qty: string }

function quantityUnitLabel(unit: TransferQuantityUnit) {
  return unit === 'KG' ? 'KG' : 'PCS/Sets'
}

function availableQuantity(product: PickedProduct) {
  return product.quantity_unit === 'KG'
    ? product.available_kg
    : product.available_pieces_sets
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
  const [lines, setLines] = useState<TransferLine[]>([])
  const [productQuery, setProductQuery] = useState('')
  const firstSourceBranch = initialSourceBranch ?? sourceBranches[0] ?? 'mombasa'
  const [sourceBranch, setSourceBranch] = useState<Branch>(firstSourceBranch)
  const [destBranch, setDestBranch] = useState<Branch>(
    () => userBranches.find((branch) => branch !== firstSourceBranch) ?? firstSourceBranch
  )
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')

  function clearPicked() {
    setPicked(null)
    setQty('')
  }

  function validateQuantity(product: PickedProduct, quantity: string) {
    const transferQty = Number(quantity)
    if (!Number.isFinite(transferQty) || transferQty <= 0) {
      return 'Please enter a valid quantity'
    }

    const unitLabel = quantityUnitLabel(product.quantity_unit)
    const availableQty = availableQuantity(product)
    if (transferQty > availableQty) {
      return `Cannot transfer ${transferQty} ${unitLabel} of ${product.product_code} - only ${availableQty} available`
    }

    return null
  }

  function addProductLine() {
    setError(null)
    if (!picked) {
      setError('Please select a product')
      return
    }

    if (lines.some((line) => line.id === picked.id)) {
      setError(`${picked.product_code} is already in this transfer`)
      return
    }

    const quantityError = validateQuantity(picked, qty)
    if (quantityError) {
      setError(quantityError)
      return
    }

    setLines((current) => [...current, { ...picked, qty }])
    clearPicked()
    setProductQuery('')
  }

  function updateLineQuantity(lineId: string, nextQty: string) {
    setLines((current) => current.map((line) => (
      line.id === lineId ? { ...line, qty: nextQty } : line
    )))
  }

  function updateLineUnit(lineId: string, nextUnit: TransferQuantityUnit) {
    setLines((current) => current.map((line) => (
      line.id === lineId
        ? { ...line, quantity_unit: nextUnit, qty: '' }
        : line
    )))
  }

  function removeLine(lineId: string) {
    setLines((current) => current.filter((line) => line.id !== lineId))
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (sourceBranch === destBranch) {
      setError('Source and destination branches must be different')
      return
    }

    if (picked) {
      setError('Add the selected product to the transfer before dispatching')
      return
    }

    if (lines.length === 0) {
      setError('Please add at least one product')
      return
    }

    for (const line of lines) {
      const quantityError = validateQuantity(line, line.qty)
      if (quantityError) {
        setError(quantityError)
        return
      }
    }

    const fd = new FormData()
    fd.set('items', JSON.stringify(lines.map((line) => ({
      product_id: line.id,
      qty: line.qty,
      quantity_unit: line.quantity_unit,
    }))))
    fd.set('source_branch', sourceBranch)
    fd.set('dest_branch', destBranch)
    fd.set('notes', notes)

    const lineCount = lines.length
    startTransition(async () => {
      try {
        await dispatchTransfer(fd)
        setSuccess(`${lineCount} ${lineCount === 1 ? 'product' : 'products'} dispatched from ${sourceBranch} to ${destBranch}. Awaiting receipt confirmation.`)
        setLines([])
        clearPicked()
        setNotes('')
        setError(null)

        setTimeout(() => setSuccess(null), 4000)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  function pickProduct(product: ProductWithStock, branch: Branch) {
    const branchStock = product.stock_levels.find((stock) => stock.branch === branch)
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
    setQty('')
    setError(null)
  }

  const availableDestinations = userBranches.filter((branch) => branch !== sourceBranch)
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
                clearPicked()
                setLines([])
                setProductQuery('')
                setError(null)
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

        {lines.length > 0 && (
          <div className="stock-transfer-lines">
            <div className="stock-transfer-lines-header">
              <div>
                <div className="form-label">Products in this transfer</div>
                <div className="stock-transfer-help">Each product will be recorded as a separate stock movement.</div>
              </div>
              <span className="badge badge-teal">{lines.length} added</span>
            </div>
            <div className="stock-transfer-line-list">
              {lines.map((line) => (
                <div key={line.id} className="stock-transfer-line">
                  <div className="stock-transfer-line-copy">
                    <div className="stock-transfer-product-code">{line.product_code}</div>
                    <div className="stock-transfer-product-name">{line.canonical_name}</div>
                  </div>
                  <select
                    aria-label={`Transfer unit for ${line.product_code}`}
                    value={line.quantity_unit}
                    onChange={(e) => updateLineUnit(line.id, e.target.value as TransferQuantityUnit)}
                    className="form-input stock-transfer-line-unit"
                  >
                    <option value="KG" disabled={line.available_kg <= 0}>KG</option>
                    <option value="PCS_SETS" disabled={line.available_pieces_sets <= 0}>PCS/Sets</option>
                  </select>
                  <input
                    aria-label={`Quantity for ${line.product_code}`}
                    id={`transfer-line-quantity-${line.id}`}
                    type="number"
                    min="0.01"
                    step="any"
                    value={line.qty}
                    onChange={(e) => updateLineQuantity(line.id, e.target.value)}
                    className="form-input stock-transfer-line-quantity"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="btn btn-ghost btn-sm stock-transfer-line-remove"
                    aria-label={`Remove ${line.product_code}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-group stock-transfer-field">
          <label className="form-label">
            Add product <span className="stock-transfer-required" aria-hidden="true">*</span>
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
                onClick={clearPicked}
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
                  const alreadyAdded = lines.some((line) => line.id === product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => pickProduct(product, sourceBranch)}
                      className="stock-transfer-product-option"
                      disabled={!hasTransferableStock || alreadyAdded}
                      title={alreadyAdded ? 'Already added to this transfer' : !hasTransferableStock ? 'No stock available at this branch' : undefined}
                    >
                      <div>
                        <div className="stock-transfer-product-code">{product.product_code}</div>
                        <div className="stock-transfer-product-name">{product.canonical_name}</div>
                      </div>
                      <div className="stock-transfer-product-quantity">
                        {alreadyAdded ? 'Added' : `${stockAtBranch} KG · ${piecesSetsAtBranch} PCS/Sets`}
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
              Quantity to add{picked ? ` (${quantityUnitLabel(picked.quantity_unit)})` : ''}{' '}
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
              placeholder={picked ? `Enter ${quantityUnitLabel(picked.quantity_unit)} quantity` : 'Select a product first'}
              disabled={!picked}
            />
            {picked && (
              <div className="stock-transfer-help">
                Maximum: {availableQuantity(picked)} {quantityUnitLabel(picked.quantity_unit)}
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

        <div className="stock-transfer-add-line">
          <span className="stock-transfer-help">Add each product and quantity, then dispatch them together.</span>
          <button
            type="button"
            onClick={addProductLine}
            disabled={!picked || !qty}
            className="btn btn-ghost"
          >
            + Add product
          </button>
        </div>

        <div className="stock-transfer-form-actions">
          <div className="stock-transfer-action-copy">
            <span className="stock-transfer-action-label">Ready to dispatch?</span>
            <span>{lines.length} {lines.length === 1 ? 'product' : 'products'} will be logged together.</span>
          </div>
          <button
            type="submit"
            disabled={isPending || lines.length === 0 || Boolean(picked)}
            className="btn btn-primary"
          >
            {isPending ? 'Transferring…' : `Transfer ${lines.length || ''} ${lines.length === 1 ? 'product' : 'products'}`}
          </button>
        </div>
      </form>
    </div>
  )
}
