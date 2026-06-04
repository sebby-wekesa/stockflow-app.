// @ts-nocheck
'use client'

import { useState, useTransition } from 'react'
import { createSalesOrder, searchProductsForSale } from '@/actions/sales'
import { searchCustomers } from '@/actions/customers'
import { BRANCH_LABELS } from '@/lib/branches'
import { formatKES } from '@/lib/sales-utils'
import type { BranchCode as Branch } from '@/lib/branches'

type LineProduct = {
  id: string
  product_code: string
  canonical_name: string
  uom: string
  category: string
  selling_price: number
  stock_at_branch: number | null
  piecesSets: number
}

type Line = {
  product?: LineProduct
  qty: string
  unit_price: string
  pieces_sets: string
  notes: string
}

type CustomerHit = {
  id: string
  name: string
  phone: string | null
}

const emptyLine = (): Line => ({ qty: '1', unit_price: '0', pieces_sets: '0', notes: '' })

export function SalesForm({
  allowedBranches,
  defaultBranch,
}: {
  allowedBranches: Branch[]
  defaultBranch: Branch
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [branch, setBranch] = useState<Branch>(() => {
    // Ensure we always start with a valid branch if provided
    return (allowedBranches.includes(defaultBranch) ? defaultBranch : allowedBranches[0]) as Branch
  })
  const [customer, setCustomer] = useState<CustomerHit | null>(null)
  const [customerName, setCustomerName] = useState('Walk-in customer')
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [orderNotes, setOrderNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([emptyLine()])

  function updateLine(index: number, partial: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...partial } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  function pickCustomer(c: CustomerHit) {
    setCustomer(c)
    setCustomerName(c.name)
    setShowCustomerSearch(false)
  }

  function clearCustomer() {
    setCustomer(null)
    setCustomerName('Walk-in customer')
  }

  function handleBranchChange(b: Branch) {
    setBranch(b)
    // Reset all picked products since stock changes by branch
    setLines((prev) => prev.map((l) => ({ ...l, product: undefined })))
  }

  // Compute totals
  const totals = lines.reduce(
    (acc, line) => {
      const piecesSets = parseFloat(line.pieces_sets) || 0
      const price = parseFloat(line.unit_price) || 0
      const lineTotal = piecesSets * price
      return {
        lineCount: acc.lineCount + (line.product ? 1 : 0),
        subtotal: acc.subtotal + lineTotal,
      }
    },
    { lineCount: 0, subtotal: 0 }
  )

  function handleSubmit(action: 'draft' | 'invoice') {
    setError(null)

    if (!branch) {
      setError('Please select a branch')
      return
    }

    // Validate
    const validLines = lines.filter((l) => l.product)
    if (validLines.length === 0) {
      setError('Add at least one line item')
      return
    }
    if (!customerName.trim()) {
      setError('Customer name is required')
      return
    }

    // Build form data
    const fd = new FormData()
    fd.set('branch', branch)
    if (customer) fd.set('customer_id', customer.id)
    fd.set('customer_name', customerName.trim())
    fd.set('invoice_date', invoiceDate)
    fd.set('notes', orderNotes)
    fd.set('action', action)
    validLines.forEach((line, i) => {
      fd.set(`line_${i}_product_id`, line.product!.id)
      fd.set(`line_${i}_qty`, line.qty)
      fd.set(`line_${i}_unit_price`, line.unit_price)
      fd.set(`line_${i}_pieces_sets`, line.pieces_sets)
      fd.set(`line_${i}_notes`, line.notes)
    })

    startTransition(async () => {
      try {
        const result = await createSalesOrder(fd)
        if (result?.error) {
          setError(result.error)
        }
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div className="sales-form">
      {error && (
        <div className="design-error mb-16">
          {error}
        </div>
      )}

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div><div className="section-title">Order Details</div><div className="section-sub">Choose the selling branch, invoice date, and customer</div></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="form-label">
              Selling from <span className="text-red">*</span>
            </label>
            <select
              value={branch}
              onChange={(e) => handleBranchChange(e.target.value as Branch)}
              className="form-input w-full"
              disabled={allowedBranches.length === 1}
            >
              {allowedBranches.map((b) => (
                <option key={b} value={b}>
                  {BRANCH_LABELS[b] ?? b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">
              Invoice date <span className="text-red">*</span>
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="form-input w-full font-mono"
            />
          </div>

          <div>
            <label className="form-label">
              Customer <span className="text-red">*</span>
            </label>
            {customer ? (
              <div className="bg-surface2 rounded-md px-3 py-2 flex items-center justify-between text-sm border border-border">
                <span className="truncate">{customer.name}</span>
                <button onClick={clearCustomer} className="text-xs text-muted hover:text-text ml-2">
                  ✕
                </button>
              </div>
            ) : showCustomerSearch ? (
              <CustomerSearch onPick={pickCustomer} onCancel={() => setShowCustomerSearch(false)} />
            ) : (
              <div className="flex gap-2">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="form-input flex-1"
                  placeholder="Walk-in customer"
                />
                <button
                  type="button"
                  onClick={() => setShowCustomerSearch(true)}
                  className="btn btn-ghost btn-sm whitespace-nowrap"
                >
                  Search
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div><div className="section-title">Line Items</div><div className="section-sub">Search live product stock and enter quantities</div></div>
          <span className="badge badge-muted">
            {totals.lineCount} {totals.lineCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="sales-line-list">
          {lines.map((line, i) => (
            <SalesLineRow
              key={i}
              line={line}
              branch={branch}
              onUpdate={(partial) => updateLine(i, partial)}
              onRemove={lines.length > 1 ? () => removeLine(i) : undefined}
            />
          ))}
        </div>

        <div className="border-t border-border pt-4 mt-4">
          <button type="button" onClick={addLine} className="btn btn-ghost btn-sm">
            + Add line
          </button>
        </div>
      </div>

      <div className="grid-2 sales-summary-grid mb-16">
        <div className="card">
          <label className="form-label">
            Order notes (optional)
          </label>
          <textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            className="form-input w-full mt-2"
            rows={3}
            placeholder="LPO numbers, vehicle reg, special instructions..."
          />
        </div>
        <div className="card">
          <div className="mb-3">
            <span className="form-label">Order Total</span>
            <div className="sales-order-total">
              {formatKES(totals.subtotal)}
            </div>
          </div>
          <div className="text-xs text-muted">
            {totals.lineCount} line {totals.lineCount === 1 ? 'item' : 'items'}
            {totals.lineCount === 0 && ' — add at least one to continue'}
          </div>
        </div>
      </div>
      <div className="sales-form-actions">
        <button
          type="button"
          onClick={() => handleSubmit('draft')}
          disabled={isPending || totals.lineCount === 0}
          className="btn btn-ghost"
        >
          Save as draft
        </button>
        <button
          type="button"
          onClick={() => handleSubmit('invoice')}
          disabled={isPending || totals.lineCount === 0}
          className="btn btn-primary"
        >
          {isPending ? 'Creating...' : 'Confirm & invoice'}
        </button>
      </div>

      <p className="section-sub text-right">
        Confirming will generate an invoice number and decrement stock immediately.
      </p>
    </div>
  )
}

// ─── Single line row component ───────────────────────────────────────────────

function SalesLineRow({
  line,
  branch,
  onUpdate,
  onRemove,
}: {
  line: Line
  branch: Branch
  onUpdate: (partial: Partial<Line>) => void
  onRemove?: () => void
}) {
  const [showPicker, setShowPicker] = useState(!line.product)

  function handleProductPick(product: LineProduct) {
    onUpdate({
      product,
      unit_price: product.selling_price > 0 ? String(product.selling_price) : '0',
      pieces_sets: product.piecesSets > 0 ? '1' : '0',
    })
    setShowPicker(false)
  }

  const qty = parseFloat(line.qty) || 0
  const piecesSets = parseFloat(line.pieces_sets) || 0
  const price = parseFloat(line.unit_price) || 0
  const lineTotal = piecesSets * price
  const exceedsStock =
    line.product &&
    line.product.stock_at_branch !== null &&
    qty > line.product.stock_at_branch

  return (
    <div className="p-4">
      {!line.product || showPicker ? (
        <ProductSearch
          branch={branch}
          onPick={handleProductPick}
          onCancel={line.product ? () => setShowPicker(false) : undefined}
        />
      ) : (
        <div className="grid grid-cols-12 gap-3 items-start">
          <div className="col-span-12 md:col-span-5">
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="text-left w-full bg-surface2 rounded-md p-2.5 hover:bg-bg transition-colors"
            >
              <div className="font-mono text-sm text-accent">{line.product.product_code}</div>
              <div className="text-xs text-muted truncate">{line.product.canonical_name}</div>
              <div className="text-[10px] text-muted mt-0.5">
                <span className={exceedsStock ? 'text-red' : 'text-teal'}>
                  {line.product.stock_at_branch} {line.product.uom} available
                </span>
              </div>
            </button>
          </div>

          <div className="col-span-4 md:col-span-2">
            <label className="form-label">
              Qty
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={line.qty}
              onChange={(e) => onUpdate({ qty: e.target.value })}
              className={`form-input font-mono`}
            />
          </div>

          <div className="col-span-4 md:col-span-1.5">
            <label className="form-label">
              Sets
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={line.pieces_sets}
              onChange={(e) => onUpdate({ pieces_sets: e.target.value })}
              className="form-input font-mono"
            />
          </div>

          <div className="col-span-4 md:col-span-1.5">
            <label className="form-label">
              Unit price
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.unit_price}
              onChange={(e) => onUpdate({ unit_price: e.target.value })}
              className="form-input font-mono"
            />
          </div>

          <div className="col-span-3 md:col-span-2 text-right">
            <label className="form-label">
              Total
            </label>
            <div className="font-mono font-medium pt-2">{formatKES(lineTotal)}</div>
          </div>

          <div className="col-span-1 text-right pt-6">
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="text-muted hover:text-red text-lg"
                title="Remove line"
              >
                ✕
              </button>
            )}
          </div>

          <div className="col-span-12">
            <input
              value={line.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              className="form-input text-xs w-full"
              placeholder="Line notes — LPO, vehicle reg, etc. (optional)"
            />
          </div>

          {exceedsStock && (
            <div className="col-span-12 text-xs text-red bg-red/10 border border-red/30 rounded p-2 px-3">
              Quantity exceeds available stock at {BRANCH_LABELS[branch]}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Product search subcomponent ─────────────────────────────────────────────

function ProductSearch({
  branch,
  onPick,
  onCancel,
}: {
  branch: Branch
  onPick: (p: LineProduct) => void
  onCancel?: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LineProduct[]>([])
  const [searching, setSearching] = useState(false)

  async function handleSearch(value: string) {
    setQuery(value)
    if (value.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const found = await searchProductsForSale(value, branch)
      setResults(found)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search product by code or name..."
          className="form-input flex-1"
        />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="border border-border rounded-md max-h-52 overflow-auto bg-surface2 text-text">
        {searching ? (
          <div className="text-sm text-muted px-3 py-3">Searching...</div>
        ) : query.length < 2 ? (
          <div className="text-sm text-muted px-3 py-3">
            Type at least 2 characters to search...
          </div>
        ) : results.length === 0 ? (
          <div className="text-sm text-muted px-3 py-3">No products found</div>
        ) : (
          results.map((r, index) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r)}
              className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-surface transition-colors text-sm border-b border-border last:border-b-0 ${
                index === 0 ? 'rounded-t-md' : ''
              }`}
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="font-mono text-[13px] text-accent">{r.product_code}</div>
                <div className="text-text truncate">{r.canonical_name}</div>
              </div>

              <div className="text-right flex-shrink-0 text-sm">
                <div className="font-medium tabular-nums text-text">{formatKES(r.selling_price)}</div>
                <div className={`text-[11px] ${r.stock_at_branch && r.stock_at_branch > 0 ? 'text-teal' : 'text-red'}`}>
                  {r.stock_at_branch ?? 0} {r.uom}
                  {r.piecesSets > 0 && ` · ${r.piecesSets} sets`}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Customer search subcomponent ────────────────────────────────────────────

function CustomerSearch({
  onPick,
  onCancel,
}: {
  onPick: (c: CustomerHit) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerHit[]>([])
  const [searching, setSearching] = useState(false)

  async function handleSearch(value: string) {
    setQuery(value)
    if (value.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const found = await searchCustomers(value)
      setResults(found)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="form-input flex-1"
        />
        <button
          type="button"
          onClick={onCancel}
          className="px-3 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      <div className="border border-border rounded-md max-h-44 overflow-auto bg-surface2 text-text">
        {searching ? (
          <div className="text-sm text-muted px-3 py-2.5">Searching...</div>
        ) : query.length < 2 ? (
          <div className="text-sm text-muted px-3 py-2.5">Type to search...</div>
        ) : results.length === 0 ? (
          <div className="text-sm text-muted px-3 py-2.5">No customers found</div>
        ) : (
          results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              className="w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-surface text-sm transition-colors"
            >
              <div className="font-medium text-text">{c.name}</div>
              {c.phone && (
                <div className="text-xs text-muted font-mono">{c.phone}</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
