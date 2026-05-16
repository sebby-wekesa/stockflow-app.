'use client'

import { useState, useTransition } from 'react'
import { resolveConflict, approveAndSyncImport } from '../../actions'
import type { ImportBatch, ImportRow } from '@prisma/client'

interface MatchResultsProps {
  batch: ImportBatch & {
    rows: ImportRow[]
  }
}

export function MatchResults({ batch }: MatchResultsProps) {
  const [selectedRow, setSelectedRow] = useState<ImportRow | null>(null)
  const [isPending, startTransition] = useTransition()

  // Calculate KPIs
  const totalRows = batch.rows.length
  const autoResolved = batch.rows.filter(r => r.resolution === 'auto').length
  const needsReview = batch.rows.filter(r => !r.resolved_product && r.mapped_data).length
  const errors = batch.rows.filter(r => r.errors).length

  const conflicts = batch.rows.filter(r =>
    r.mapped_data &&
    (!r.resolved_product || r.match_confidence && r.match_confidence < 0.85)
  )

  function handleResolve(rowId: string, productId: string) {
    startTransition(async () => {
      await resolveConflict(batch.id, rowId, productId)
      setSelectedRow(null)
    })
  }

  function handleApproveAndSync() {
    startTransition(async () => {
      await approveAndSyncImport(batch.id)
    })
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-500">{autoResolved}</div>
          <div className="text-sm text-muted">Auto-resolved</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{needsReview}</div>
          <div className="text-sm text-muted">Need review</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-red-500">{errors}</div>
          <div className="text-sm text-muted">Errors</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold">{totalRows}</div>
          <div className="text-sm text-muted">Total rows</div>
        </div>
      </div>

      {/* Sample Resolved Rows */}
      <div className="card p-6">
        <h3 className="font-head text-lg font-bold mb-4">Sample Resolved Rows</h3>
        <div className="space-y-2">
          {batch.rows.slice(0, 6).map((row) => {
            const mappedData = row.mapped_data as Record<string, unknown>
            return (
              <div key={row.id} className="flex items-center justify-between p-3 bg-surface2 rounded-md">
                <div className="flex-1">
                  <div className="text-sm font-medium">{mappedData.raw_product_name}</div>
                  <div className="text-xs text-muted">
                    {mappedData.qty} × {mappedData.unit_price} = {(row.qty || 0) * (row.unit_price || 0)}
                  </div>
                </div>
                <div className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                  {row.resolution === 'auto' ? 'Auto-matched' : 'Resolved'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Conflicts Panel */}
      {conflicts.length > 0 && (
        <div className="card p-6">
          <h3 className="font-head text-lg font-bold mb-4">Conflicts ({conflicts.length})</h3>
          <div className="space-y-3">
            {conflicts.map((row) => {
              const mappedData = row.mapped_data as Record<string, unknown>
              const isLowConfidence = row.match_confidence && row.match_confidence < 0.85

              return (
                <div key={row.id} className="p-4 border border-orange-500/30 rounded-md">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-sm">{mappedData.raw_product_name}</div>
                      <div className="text-xs text-muted mt-1">
                        Row {row.row_number} · {mappedData.qty} units
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-600">
                      {isLowConfidence ? 'Low confidence' : 'Unresolved'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {isLowConfidence && row.matched_product && (
                      <button
                        onClick={() => handleResolve(row.id, row.matched_product!)}
                        className="btn btn-sm btn-ghost"
                        disabled={isPending}
                      >
                        Confirm suggestion
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedRow(row)}
                      className="btn btn-sm btn-primary"
                      disabled={isPending}
                    >
                      Map to different product
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sync Section */}
      <div className="card p-6">
        <h3 className="font-head text-lg font-bold mb-4">Approve & Sync</h3>
        <div className="bg-blue/10 border border-blue/30 p-4 rounded-md mb-4">
          <p className="text-sm text-blue">
            <strong>Review your data:</strong> {autoResolved} rows auto-matched, {needsReview} need review, {errors} have errors.
            Click "Approve & Sync" to process this data into your live inventory and create sales records.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={handleApproveAndSync}
            disabled={isPending || conflicts.length > 0}
            className="btn btn-primary"
          >
            {isPending ? 'Processing...' : 'Approve & Sync'}
          </button>
        </div>
      </div>

      {/* Product Search Modal */}
      {selectedRow && (
        <ProductSearchModal
          row={selectedRow}
          onSelect={(productId) => handleResolve(selectedRow.id, productId)}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  )
}

function ProductSearchModal({
  row,
  onSelect,
  onClose
}: {
  row: ImportRow
  onSelect: (productId: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; name: string; sku: string }>>([])
  const [isSearching, setIsSearching] = useState(false)

  async function searchProducts(searchQuery: string) {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  useState(() => {
    const mappedData = row.mapped_data as Record<string, unknown>
    const initialQuery = mappedData.raw_product_name as string
    setQuery(initialQuery)
    searchProducts(initialQuery)
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="font-head text-lg font-bold mb-4">Map to Product</h3>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            searchProducts(e.target.value)
          }}
          placeholder="Search products..."
          className="input w-full mb-4"
        />

        <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
          {isSearching ? (
            <div className="text-center text-muted py-4">Searching...</div>
          ) : results.length === 0 ? (
            <div className="text-center text-muted py-4">No products found</div>
          ) : (
            results.map((product) => (
              <button
                key={product.id}
                onClick={() => onSelect(product.id)}
                className="w-full text-left p-3 bg-surface2 rounded-md hover:bg-surface transition-colors"
              >
                <div className="font-medium text-sm">{product.name}</div>
                <div className="text-xs text-muted">{product.sku}</div>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}