'use client'

import { useState, useTransition } from 'react'
import { resolveImportConflict, searchProductsForMapping } from '../../actions'
import type { ConflictRow } from '@/lib/import/conflict-resolver'

export function ConflictsStep({
  batchId,
  conflicts,
}: {
  batchId: string
  conflicts: ConflictRow[]
}) {
  const [error, setError] = useState<string | null>(null)

  if (conflicts.length === 0) {
    return (
      <div className="card p-5 mb-6 border-teal/30">
        <div className="flex items-center gap-2">
          <span className="text-teal">✓</span>
          <div className="font-head font-bold text-teal">All conflicts resolved</div>
        </div>
        <p className="text-xs text-muted mt-1">
          Every row has been matched to a canonical product. Ready to commit.
        </p>
      </div>
    )
  }

  return (
    <div className="card p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-head font-bold">Conflict resolution</div>
          <p className="text-xs text-muted mt-1">
            {conflicts.length} flagged {conflicts.length === 1 ? 'row' : 'rows'} need manual
            review. Each decision is saved as an alias for future imports.
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent">
          {conflicts.length} pending
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {conflicts.map((conflict) => (
          <ConflictCard
            key={conflict.import_row_id}
            batchId={batchId}
            conflict={conflict}
            onError={setError}
          />
        ))}
      </div>
    </div>
  )
}

function ConflictCard({
  batchId,
  conflict,
  onError,
}: {
  batchId: string
  conflict: ConflictRow
  onError: (msg: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [showMapper, setShowMapper] = useState(false)

  function resolve(action: any) {
    onError('')
    startTransition(async () => {
      try {
        await resolveImportConflict(batchId, conflict.import_row_id, action)
      } catch (err) {
        onError((err as Error).message)
      }
    })
  }

  return (
    <div className="border border-border rounded-md p-4 bg-surface2">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Row {conflict.row_number} ·{' '}
            {conflict.conflict_type === 'unresolved_product'
              ? 'unresolved product'
              : conflict.conflict_type === 'low_confidence_fuzzy'
              ? 'low confidence match'
              : conflict.conflict_type}
          </div>
          <div className="font-mono text-sm truncate">{conflict.raw_name}</div>
          <div className="text-xs text-muted mt-1">{conflict.conflict_detail}</div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full ml-3 flex-shrink-0 ${
            conflict.conflict_type === 'unresolved_product'
              ? 'bg-red/15 text-red'
              : 'bg-accent/15 text-accent'
          }`}
        >
          {conflict.conflict_type === 'unresolved_product'
            ? 'Unresolved'
            : 'Low confidence'}
        </span>
      </div>

      {showMapper ? (
        <ProductMapper
          isPending={isPending}
          onPick={(productId) =>
            resolve({ type: 'map_to_existing', product_id: productId })
          }
          onCancel={() => setShowMapper(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {conflict.conflict_type === 'low_confidence_fuzzy' && (
            <button
              type="button"
              onClick={() => resolve({ type: 'confirm_fuzzy' })}
              disabled={isPending}
              className="btn btn-sm btn-primary"
            >
              Confirm: {conflict.suggested_product_name}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowMapper(true)}
            disabled={isPending}
            className="btn btn-sm btn-ghost"
          >
            Map to different product
          </button>
          <button
            type="button"
            onClick={() => resolve({ type: 'skip' })}
            disabled={isPending}
            className="btn btn-sm btn-ghost text-red"
          >
            Skip row
          </button>
        </div>
      )}
    </div>
  )
}

function ProductMapper({
  isPending,
  onPick,
  onCancel,
}: {
  isPending: boolean
  onPick: (productId: string) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    Array<{ id: string; product_code: string; canonical_name: string; category: string }>
  >([])
  const [searching, setSearching] = useState(false)

  async function handleSearch(value: string) {
    setQuery(value)
    if (value.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const found = await searchProductsForMapping(value)
      setResults(found as any)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="bg-bg rounded-md p-3 border border-border">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search by code or name (e.g. BL-BC37)..."
        className="input text-sm mb-2"
      />
      <div className="max-h-48 overflow-y-auto">
        {searching ? (
          <div className="text-xs text-muted px-2 py-1">Searching...</div>
        ) : results.length === 0 ? (
          <div className="text-xs text-muted px-2 py-1">
            {query.length < 2 ? 'Type at least 2 characters...' : 'No matches found'}
          </div>
        ) : (
          results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r.id)}
              disabled={isPending}
              className="w-full text-left px-2 py-2 rounded-md hover:bg-surface2 text-xs"
            >
              <div className="font-mono text-accent">{r.product_code}</div>
              <div className="text-muted truncate">{r.canonical_name}</div>
            </button>
          ))
        )}
      </div>
      <div className="flex justify-end mt-2">
        <button type="button" onClick={onCancel} className="text-xs text-muted hover:text-text">
          Cancel
        </button>
      </div>
    </div>
  )
}
