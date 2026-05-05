'use client'

import { useState, useTransition } from 'react'

type Props = {
  mode: 'create' | 'edit'
  action: (formData: FormData) => Promise<void>
  initial?: { name?: string; contactInfo?: string | null }
}

export function CustomerForm({ mode, action, initial }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <form
      className="card p-5 space-y-4"
      action={(formData) => {
        setError(null)
        startTransition(async () => {
          try {
            await action(formData)
          } catch (err) {
            setError((err as Error).message)
          }
        })
      }}
    >
      {error && (
        <div className="p-3 rounded-md bg-red/10 border border-red/30 text-red text-sm">
          {error}
        </div>
      )}
      <div>
        <label className="block text-xs uppercase tracking-wider text-muted mb-2">Name</label>
        <input name="name" defaultValue={initial?.name ?? ''} className="input" required />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-muted mb-2">Contact Info</label>
        <textarea
          name="contactInfo"
          defaultValue={initial?.contactInfo ?? ''}
          className="input"
          rows={3}
          placeholder="Phone, email, address, notes"
        />
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? 'Saving...' : mode === 'create' ? 'Create customer' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
