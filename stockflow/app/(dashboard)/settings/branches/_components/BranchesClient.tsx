'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBranch, updateBranch, deleteBranch } from '@/actions/branches'

interface Branch {
  id: string
  name: string
  code: string
  location: string | null
  address: string | null
  phone: string | null
  createdAt: string
  userCount: number
  productCount: number
  movementCount: number
}

export function BranchesClient({
  branches,
  canDelete,
}: {
  branches: Branch[]
  canDelete: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<Branch | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  function handleSaved() {
    setEditing(null)
    setShowCreate(false)
    router.refresh()
  }

  return (
    <>
      <div className="card p-4 mb-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>
              {branches.length === 0
                ? 'No branches yet'
                : `${branches.length} branch${branches.length === 1 ? '' : 'es'}`}
            </div>
            <div className="text-muted text-sm">
              Add the locations where stock moves through your business.
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">
            + Add branch
          </button>
        </div>
      </div>

      {branches.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-muted">
            Get started by adding your first branch. You can add as many as you need.
          </div>
        </div>
      ) : (
        <div className="card p-0" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Code</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Location</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Users · Products · Movements</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{b.name}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{b.code}</td>
                  <td style={{ padding: '12px 16px' }} className="text-muted">
                    {b.location ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {b.userCount} · {b.productCount} · {b.movementCount}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <BranchRowActions
                      branch={b}
                      canDelete={canDelete}
                      onEdit={() => setEditing(b)}
                      onDeleted={handleSaved}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showCreate || editing) && (
        <BranchModal
          branch={editing}
          onClose={() => {
            setShowCreate(false)
            setEditing(null)
          }}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

function BranchRowActions({
  branch,
  canDelete,
  onEdit,
  onDeleted,
}: {
  branch: Branch
  canDelete: boolean
  onEdit: () => void
  onDeleted: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (
      !confirm(
        `Delete branch "${branch.name}"? This cannot be undone. The branch must have no users, products, or movements attached.`
      )
    ) {
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await deleteBranch(branch.id)
      if (res && 'error' in res && res.error) {
        setError(res.error)
        // Show the error in an alert too since the row will re-render away on success
        alert(res.error)
      } else {
        onDeleted()
      }
    })
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
      <button onClick={onEdit} disabled={isPending} className="btn btn-ghost btn-sm">
        Edit
      </button>
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--danger, #ef4444)' }}
        >
          Delete
        </button>
      )}
      {error && (
        <div style={{ position: 'absolute' }} className="text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}

function BranchModal({
  branch,
  onClose,
  onSaved,
}: {
  branch: Branch | null
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = branch
        ? await updateBranch(branch.id, fd)
        : await createBranch(fd)
      if (res && 'error' in res && res.error) {
        setError(res.error)
      } else {
        onSaved()
      }
    })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 480, width: '100%', padding: '24px', margin: '0 16px' }}
      >
        <h2 className="section-title mb-4">
          {branch ? `Edit ${branch.name}` : 'Add a branch'}
        </h2>

        {error && (
          <div
            className="mb-4 p-3 rounded-md"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5',
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">Name</label>
            <input
              name="name"
              defaultValue={branch?.name ?? ''}
              required
              minLength={2}
              maxLength={120}
              className="input w-full"
              placeholder="Mombasa Warehouse"
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Code (used in invoice prefixes)
            </label>
            <input
              name="code"
              defaultValue={branch?.code ?? ''}
              required
              minLength={2}
              maxLength={10}
              pattern="[A-Za-z0-9_-]+"
              className="input w-full"
              placeholder="mombasa"
              disabled={isPending}
            />
            <div className="text-xs text-muted mt-1">
              2-10 characters. Letters, numbers, hyphens, underscores.
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Location (optional)
            </label>
            <input
              name="location"
              defaultValue={branch?.location ?? ''}
              maxLength={120}
              className="input w-full"
              placeholder="City or area"
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Address (optional)
            </label>
            <textarea
              name="address"
              defaultValue={branch?.address ?? ''}
              maxLength={500}
              rows={2}
              className="input w-full"
              placeholder="Street, building, etc."
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Phone (optional)
            </label>
            <input
              name="phone"
              defaultValue={branch?.phone ?? ''}
              maxLength={40}
              className="input w-full"
              placeholder="+254 ..."
              disabled={isPending}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary">
              {isPending ? 'Saving…' : branch ? 'Save changes' : 'Create branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
