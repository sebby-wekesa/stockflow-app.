// @ts-nocheck
'use client'

import { useState, useTransition, useActionState, useEffect } from 'react'
import { inviteUser, linkAndVerifyAuthUser, updateUser, verifyUser } from '@/app/actions/users'
import { UserForm } from '@/components/users/UserForm'
import type { User } from '@prisma/client'

interface InviteModalProps {
  onClose: () => void
}

export function InviteModal({ onClose }: InviteModalProps) {
  const [state, formAction, isPending] = useActionState(inviteUser, null)

  // Close modal on successful invite
  useEffect(() => {
    if (state?.success) {
      onClose()
    }
  }, [state, onClose])

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <form action={formAction} className="space-y-4">
          <h3 className="font-bold text-lg mb-4">Invite new user</h3>

          {state && !state.success && (
            <div className="alert alert-error">
              <span>{state.error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Email address</label>
            <input
              type="email"
              name="email"
              className="form-input w-full"
              placeholder="user@company.com"
              required
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Full name</label>
            <input
              type="text"
              name="name"
              className="form-input w-full"
              placeholder="John Doe"
              required
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Role</label>
            <select name="role" className="form-input w-full" required disabled={isPending}>
              <option value="">Select a role</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="OPERATOR">Operator</option>
              <option value="WAREHOUSE">Warehouse</option>
              <option value="SALES">Sales</option>
              <option value="PACKAGING">Packaging</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-2">Branches</label>
            <div className="space-y-2">
              {(['mombasa', 'nairobi', 'bunje'] as const).map((branch) => (
                <label key={branch} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="branches"
                    value={branch}
                    className="checkbox"
                    defaultChecked={branch === 'mombasa'}
                    disabled={isPending}
                  />
                  <span className="capitalize">{branch}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? 'Sending...' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface UserTableProps {
  users: User[]
}

export function UserTable({ users }: UserTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleVerify(userId: string) {
    setVerifyError(null)
    setVerifyingId(userId)
    startTransition(async () => {
      try {
        await verifyUser(userId)
      } catch (err) {
        setVerifyError((err as Error).message || 'Failed to verify user.')
      } finally {
        setVerifyingId(null)
      }
    })
  }

  return (
    <div className="card">
      {verifyError && (
        <div className="alert alert-error mb-4">
          <span>{verifyError}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="font-medium">{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`badge ${
                    user.role === 'ADMIN' ? 'badge-error' :
                    user.role === 'MANAGER' ? 'badge-warning' :
                    user.role === 'WAREHOUSE' ? 'badge-info' :
                    user.role === 'SALES' ? 'badge-success' :
                    user.role === 'OPERATOR' ? 'badge-primary' :
                    user.role === 'PACKAGING' ? 'badge-secondary' :
                    'badge-neutral'
                  } badge-sm`}>
                    {user.role}
                  </span>
                </td>
                 <td>
                   {user.branchId || (
                    <span className="text-gray-400 text-xs">
                      No branch
                    </span>
                  )}
                </td>
                <td>
                  <span className={`badge ${user.isVerified ? 'badge-primary' : 'badge-warning'} badge-sm`}>
                    {user.isVerified ? 'Verified' : 'Unverified'}
                  </span>
                  {user.role === 'PENDING' && (
                    <span className="badge badge-neutral badge-sm ml-2">
                      Pending role
                    </span>
                  )}
                </td>
                <td className="flex gap-2">
                  {!user.isVerified && (
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => handleVerify(user.id)}
                      disabled={verifyingId === user.id}
                    >
                      {verifyingId === user.id ? 'Verifying...' : 'Verify'}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => setEditingId(user.id)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className="modal-overlay open" onClick={() => setEditingId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditingId(null)}>✕</button>
            
            <h3 className="font-bold text-lg mb-4">Edit user</h3>
            <UserForm
              mode="edit"
              initial={{
                ...users.find((u) => u.id === editingId),
                branchId: users.find((u) => u.id === editingId)?.branchId ?? undefined
              }}
              action={async (formData) => {
                formData.append('userId', editingId!)
                await updateUser(formData)
                setEditingId(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface AuthOnlyUsersTableProps {
  users: Array<{
    id: string
    email: string
    name: string | null
    isVerified: boolean
    createdAt: string | null
  }>
}

export function AuthOnlyUsersTable({ users }: AuthOnlyUsersTableProps) {
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleLinkAndVerify(userId: string) {
    setLinkError(null)
    setLinkingId(userId)
    startTransition(async () => {
      try {
        await linkAndVerifyAuthUser(userId)
        window.location.reload()
      } catch (err) {
        setLinkError((err as Error).message || 'Failed to add and verify user.')
      } finally {
        setLinkingId(null)
      }
    })
  }

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="font-head text-lg font-bold">Unlinked Supabase users</h2>
        <p className="text-muted text-sm mt-1">
          These accounts exist in Supabase Auth but are not linked to this organization yet.
        </p>
      </div>

      {linkError && (
        <div className="alert alert-error mb-4">
          <span>{linkError}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="font-medium">{user.name || 'Unnamed User'}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`badge ${user.isVerified ? 'badge-primary' : 'badge-warning'} badge-sm`}>
                    {user.isVerified ? 'Verified' : 'Unverified'}
                  </span>
                </td>
                <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                <td>
                  <button
                    className="btn btn-primary btn-xs"
                    onClick={() => handleLinkAndVerify(user.id)}
                    disabled={linkingId === user.id}
                  >
                    {linkingId === user.id ? 'Adding...' : 'Add & Verify'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
