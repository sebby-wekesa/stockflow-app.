'use client'

import { useState, useTransition } from 'react'
import { updateUser, toggleUserActive, resendInvite, sendPasswordReset } from '@/actions/users'
import { BRANCH_LABELS } from '@/lib/branches'
import { UserForm } from './UserForm'
import type { User } from '@prisma/client'

const ROLE_BADGES = {
  admin: 'badge-error',
  manager: 'badge-warning',
  warehouse: 'badge-info',
  sales: 'badge-success',
  accountant: 'badge-neutral',
}

export function UserTable({ users }: { users: User[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="card">
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branches</th>
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
                  <span className={`badge ${ROLE_BADGES[user.role]} badge-sm`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {(user.branches ?? []).map((branch) => (
                      <span key={branch} className="badge badge-outline badge-xs">
                        {BRANCH_LABELS[branch as keyof typeof BRANCH_LABELS]}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className="badge badge-primary badge-sm">
                    Active
                  </span>
                </td>
                <td>
                  <div className="dropdown dropdown-left">
                    <label tabIndex={0} className="btn btn-ghost btn-xs">
                      ⋯
                    </label>
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                      <li>
                        <a onClick={() => setEditingId(user.id)}>Edit user</a>
                      </li>
                      <li>
                        <a
                          onClick={() => {
                            if (confirm('Send password reset email?')) {
                              startTransition(() => sendPasswordReset(user.id))
                            }
                          }}
                        >
                          Send password reset
                        </a>
                      </li>
                      {!user.is_active && (
                        <li>
                          <a
                            onClick={() => {
                              if (confirm('Resend invitation email?')) {
                                startTransition(() => resendInvite(user.id))
                              }
                            }}
                          >
                            Resend invite
                          </a>
                        </li>
                      )}
                      <li>
                        <a
                          className={user.is_active ? 'text-error' : 'text-success'}
                          onClick={() => {
                            const action = user.is_active ? 'deactivate' : 'reactivate'
                            if (confirm(`Are you sure you want to ${action} this user?`)) {
                              startTransition(() => toggleUserActive(user.id))
                            }
                          }}
                        >
                          {user.is_active ? 'Deactivate' : 'Reactivate'}
                        </a>
                      </li>
                    </ul>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingId && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Edit user</h3>
            <UserForm
              mode="edit"
              initial={users.find((u) => u.id === editingId)}
              action={async (formData) => {
                await updateUser(editingId, formData)
                setEditingId(null)
              }}
            />
          </div>
          <div className="modal-backdrop" onClick={() => setEditingId(null)} />
        </dialog>
      )}
    </div>
  )
}