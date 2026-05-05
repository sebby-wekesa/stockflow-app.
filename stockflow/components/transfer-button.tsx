'use client'

import { useState, useTransition } from 'react'
import { dispatchTransfer, searchProductsWithStock } from '@/app/actions/stock'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/lib/branches'
import type { BranchEnum } from '@prisma/client'

type Picked = {
  id: string
  code: string
  name: string
  uom: string | null
  stockAtBranch: number | null
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
  const [source, setSource] = useState<BranchEnum>('mombasa')
  const [dest, setDest] = useState<BranchEnum>('nairobi')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Picked[]>([])

  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const res = await searchProductsWithStock(query, source)
    setResults(res)
  }

  const handleSubmit = (e: React.FormEvent) => {
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
    const q = parseInt(qty)
    if (isNaN(q) || q <= 0) {
      setError('Invalid quantity')
      return
    }

    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set('productId', picked.id)
        fd.set('sourceBranch', source)
        fd.set('destBranch', dest)
        fd.set('qty', qty)
        if (notes) fd.set('notes', notes)
        await dispatchTransfer(fd)
        onClose()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Transfer Stock Between Branches</h3>
        {error && <div className="text-red-400 mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm mb-2">Source Branch</label>
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value as BranchEnum)
                setPicked(null)
                setResults([])
              }}
              className="w-full p-2 border rounded"
            >
              {ALL_BRANCHES.map(b => (
                <option key={b} value={b}>{BRANCH_LABELS[b]}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-2">Destination Branch</label>
            <select
              value={dest}
              onChange={(e) => setDest(e.target.value as BranchEnum)}
              className="w-full p-2 border rounded"
            >
              {ALL_BRANCHES.filter(b => b !== source).map(b => (
                <option key={b} value={b}>{BRANCH_LABELS[b]}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-2">Product</label>
            <input
              type="text"
              placeholder="Search by code or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                handleSearch(e.target.value)
              }}
              className="w-full p-2 border rounded"
            />
            {results.length > 0 && (
              <div className="border rounded mt-2 max-h-40 overflow-y-auto">
                {results.map(r => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setPicked(r)
                      setSearch(`${r.code} - ${r.name}`)
                      setResults([])
                    }}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {r.code} - {r.name} ({r.stockAtBranch ?? 0} in stock)
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-2">Quantity</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              min="1"
              max={picked?.stockAtBranch}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border rounded"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost flex-1"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={isPending || !picked}
            >
              {isPending ? 'Transferring...' : 'Transfer Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}