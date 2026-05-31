'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getBranches } from '@/app/actions/users'
import type { UserRole } from '@/lib/types'

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'ADMIN',
    label: 'Admin',
    description: 'Full access including user management and imports',
  },
  {
    value: 'MANAGER',
    label: 'Manager',
    description: 'Can approve, view all reports, manage production',
  },
  {
    value: 'OPERATOR',
    label: 'Operator',
    description: 'Manage production stages and operations',
  },
  {
    value: 'WAREHOUSE',
    label: 'Warehouse',
    description: 'Receive raw materials, manage inventory',
  },
  {
    value: 'SALES',
    label: 'Sales',
    description: 'Record sales for assigned branches',
  },
  {
    value: 'PACKAGING',
    label: 'Packaging',
    description: 'Handle finished goods packaging',
  },
]

type Initial = {
  email?: string
  name?: string
  role?: UserRole
  branchId?: string
}

export function UserForm({
  mode,
  initial,
  action,
}: {
  mode: 'invite' | 'edit'
  initial?: Initial
  action: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    getBranches().then(setBranches)
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await action(formData)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">
            <span className="label-text">Full name</span>
          </label>
          <input
            type="text"
            name="name"
            className="input input-bordered w-full"
            defaultValue={initial?.name}
            required
          />
        </div>

        {mode === 'invite' && (
          <div>
            <label className="label">
              <span className="label-text">Email address</span>
            </label>
            <input
              type="email"
              name="email"
              className="input input-bordered w-full"
              defaultValue={initial?.email}
              required
            />
          </div>
        )}
      </div>

      <div>
        <label className="label">
          <span className="label-text">Role</span>
        </label>
        <select
          name="role"
          className="select select-bordered w-full"
          defaultValue={initial?.role}
          required
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <div className="text-sm text-gray-600 mt-1">
          {ROLE_OPTIONS.find((r) => r.value === initial?.role)?.description}
        </div>
      </div>

      <div>
        <label className="label">
          <span className="label-text">Branch</span>
        </label>
        <select
          name="branchId"
          className="select select-bordered w-full"
          defaultValue={initial?.branchId}
        >
          <option value="">Select a branch</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? 'Saving...' : mode === 'invite' ? 'Send invite' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
