'use client'

import { useState, useTransition } from 'react'
import type { ProductAlias } from '@prisma/client'
import { addAlias, removeAlias } from '../actions'

export function AliasManager({
  productId,
  aliases,
}: {
  productId: string
  aliases: ProductAlias[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newAlias, setNewAlias] = useState('')

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!newAlias.trim()) return
    const fd = new FormData()
    fd.set('alias', newAlias.trim())
    startTransition(async () => {
      try {
        await addAlias(productId, fd)
        setNewAlias('')
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  function handleRemove(aliasId: string) {
    setError(null)
    startTransition(async () => {
      try {
        await removeAlias(productId, aliasId)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div>
      {error && (
        <div className="mb-3 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          placeholder="Add a new alias (e.g. BRAKELINING BC37 XTRAKE)"
          className="input flex-1"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || !newAlias.trim()}
          className="btn btn-primary"
        >
          {isPending ? 'Adding...' : 'Add alias'}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {aliases.length === 0 ? (
          <p className="text-sm text-muted">No aliases yet.</p>
        ) : (
          aliases.map((a) => (
            <div
              key={a.id}
              className="inline-flex items-center gap-2 bg-purple/10 text-purple px-3 py-1.5 rounded-md text-xs font-mono"
            >
              <span>{a.alias}</span>
              {a.source === 'canonical' ? (
                <span className="text-[10px] text-muted normal-case">canonical</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleRemove(a.id)}
                  disabled={isPending}
                  className="text-muted hover:text-red transition-colors"
                  aria-label={`Remove alias ${a.alias}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}