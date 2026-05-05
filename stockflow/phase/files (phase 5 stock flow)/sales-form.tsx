'use client'

import { useState, useTransition } from 'react'
import { createSalesOrder, searchProductsForSale } from '../actions'
import { searchCustomers } from '../../customers/actions'
import { BRANCH_LABELS } from '@/lib/branches'
import { formatKES } from '@/lib/sales'
import type { Branch } from '@prisma/client'

type LineProduct = {
  id: string
  product_code: string
  canonical_name: string
  uom: string
  category: string
  selling_price: number
  stock_at_branch: number | null
}

type Line = {
  product?: LineProduct
  qty: string
  unit_price: string
  notes: string
}

type CustomerHit = {
  id: string
  name: string
  phone: string | null
}

const emptyLine = (): Line => ({ qty: '1', unit_price: '0', notes: '' })

export function SalesForm({
  allowedBranches,
  defaultBranch,
}: {
  allowedBranches: Branch[]
  defaultBranch: Branch
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [branch, setBranch] = useState<Branch>(defaultBranch)
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
      const qty = parseFloat(line.qty) || 0
      const price = parseFloat(line.unit_price) || 0
      const lineTotal = qty * price
      return {
        lineCount: acc.lineCount + (line.product ? 1 : 0),
        subtotal: acc.subtotal + lineTotal,
      }
    },
    { lineCount: 0, subtotal: 0 }
  )

  function handleSubmit(action: 'draft' | 'invoice') {
    setError(null)

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
      fd.set(`line_${i}_notes`, line.notes)
    })

    startTransition(async () => {
      try {
        await createSalesOrder(fd)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* HEADER: branch + customer + date */}
      <div className="card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Selling from <span className="text-red">*</span>
            </label>
            <select
              value={branch}
              onChange={(e) => handleBranchChange(e.target.value as Branch)}
              className="input"
              disabled={allowedBranches.length === 1}
            >
              {allowedBranches.map((b) => (
                <option key={b} value={b}>
                  {BRANCH_LABELS[b]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Invoice date <span className="text-red">*</span>
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="input font-mono"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Customer <span className="text-red">*</span>
            </label>
            {customer ? (
              <div className="bg-surface2 rounded-md px-3 py-2 flex items-center justify-between text-sm">
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
                  className="input flex-1"
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

      {/* LINE ITEMS */}
      <div className="card mb-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="font-head font-bold text-sm">Line items</div>
          <span className="text-xs text-muted">
            {totals.lineCount} {totals.lineCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="divide-y divide-border">
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

        <div className="p-4 border-t border-border">
          <button type="button" onClick={addLine} className="btn btn-ghost btn-sm">
            + Add line
          </button>
        </div>
      </div>

      {/* NOTES + TOTAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card p-5">
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Order notes (optional)
          </label>
          <textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            className="input"
            rows={3}
            placeholder="LPO numbers, vehicle reg, special instructions..."
          />
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">Total</span>
            <span className="font-head text-2xl font-bold font-mono">
              {formatKES(totals.subtotal)}
            </span>
          </div>
          <div className="text-xs text-muted">
            {totals.lineCount} line {totals.lineCount === 1 ? 'item' : 'items'}
            {totals.lineCount === 0 && ' · add at least one to continue'}
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex justify-end gap-2">
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

      <p className="text-xs text-muted mt-2 text-right">
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
    })
    setShowPicker(false)
  }

  const qty = parseFloat(line.qty) || 0
  const price = parseFloat(line.unit_price) || 0
  const lineTotal = qty * price
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
                {line.product.category === 'service' ? (
                  <span>service · no stock</span>
                ) : (
                  <span className={exceedsStock ? 'text-red' : 'text-teal'}>
                    {line.product.stock_at_branch} {line.product.uom} available
                  </span>
                )}
              </div>
            </button>
          </div>

          <div className="col-span-4 md:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
              Qty
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={line.qty}
              onChange={(e) => onUpdate({ qty: e.target.value })}
              className={`input font-mono ${exceedsStock ? 'border-red' : ''}`}
            />
          </div>

          <div className="col-span-4 md:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
              Unit price
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.unit_price}
              onChange={(e) => onUpdate({ unit_price: e.target.value })}
              className="input font-mono"
            />
          </div>

          <div className="col-span-3 md:col-span-2 text-right">
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
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
              className="input text-xs"
              placeholder="Line notes — LPO, vehicle reg, etc. (optional)"
            />
          </div>

          {exceedsStock && (
            <div className="col-span-12 text-xs text-red">
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
      setResults(found as any)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="bg-surface2 rounded-md p-3 border border-border">
      <div className="flex gap-2 mb-2">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search product by code or name..."
          className="input text-sm flex-1"
        />
        {onCancel && (
          <button onClick={onCancel} className="btn btn-ghost btn-sm">
            Cancel
          </button>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto">
        {searching ? (
          <div className="text-xs text-muted px-2 py-2">Searching...</div>
        ) : query.length < 2 ? (
          <div className="text-xs text-muted px-2 py-2">
            Type at least 2 characters to search...
          </div>
        ) : results.length === 0 ? (
          <div className="text-xs text-muted px-2 py-2">No products found</div>
        ) : (
          results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r)}
              className="w-full text-left px-2 py-2 rounded-md hover:bg-bg text-xs flex items-center justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-accent">{r.product_code}</div>
                <div className="text-muted truncate">{r.canonical_name}</div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="font-mono text-sm">{formatKES(r.selling_price)}</div>
                {r.category !== 'service' && (
                  <div className={`text-[10px] ${
                    (r.stock_at_branch ?? 0) > 0 ? 'text-teal' : 'text-red'
                  }`}>
                    {r.stock_at_branch} avail
                  </div>
                )}
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
      setResults(found as any)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="bg-surface2 rounded-md p-2 border border-border">
      <div className="flex gap-2 mb-2">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="input text-sm flex-1"
        />
        <button onClick={onCancel} className="text-xs text-muted hover:text-text px-2">
          ✕
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {searching ? (
          <div className="text-xs text-muted px-2 py-1">Searching...</div>
        ) : query.length < 2 ? (
          <div className="text-xs text-muted px-2 py-1">Type to search...</div>
        ) : results.length === 0 ? (
          <div className="text-xs text-muted px-2 py-1">No customers found</div>
        ) : (
          results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-bg text-xs"
            >
              <div className="font-medium truncate">{c.name}</div>
              {c.phone && (
                <div className="text-muted font-mono text-[10px]">{c.phone}</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
