'use client'

import { useState, useTransition, useActionState, useEffect } from 'react'
import { inviteUser, updateUser } from '@/app/actions/users'
import { UserForm } from '@/components/users/UserForm'
import type { User } from '@prisma/client'

interface InviteModalProps {
  onClose: () => void
}

function InviteModal({ onClose }: InviteModalProps) {
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
              {(['mombasa', 'nairobi', 'bonje'] as const).map((branch) => (
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

function UserTable({ users }: UserTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="card">
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
                  {user.Branch?.name || (
                    <span className="text-gray-400 text-xs">
                      No branch
                    </span>
                  )}
                </td>
                <td>
                  <span className="badge badge-primary badge-sm">
                    Active
                  </span>
                </td>
                <td>
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
                branchId: users.find((u) => u.id === editingId)?.branchId
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

export { InviteModal, UserTable }