"use client";

import { updateUserRole, deleteUser } from "@/app/actions/users";
import { useTransition, useState } from "react";
import type { UserRole } from "@/lib/types";

// Define exactly what the component needs
interface UserRowProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    department?: string | null;
  }
}

export function UserRow({ user }: UserRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;

    setError(null);
    // Wrap the server action in startTransition to keep the UI responsive
    startTransition(async () => {
      try {
        await updateUserRole(user.id, newRole);
      } catch {
        setError("Failed to update role. Please try again.");
      }
    });
  };

  const handleDelete = () => {
    if (confirm(`Delete user ${user.email}?`)) {
      setError(null);
      startTransition(async () => {
        try {
          await deleteUser(user.id);
        } catch {
          setError("Failed to delete user. Please try again.");
        }
      });
    }
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
        <select
          disabled={isPending}
          defaultValue={user.role}
          onChange={handleChange}
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border2)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            color: 'var(--text)',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="PENDING">Pending</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="OPERATOR">Operator</option>
          <option value="WAREHOUSE">Warehouse</option>
          <option value="SALES">Sales</option>
          <option value="PACKAGING">Packaging</option>
        </select>
        <button
          disabled={isPending}
          onClick={handleDelete}
          className="btn-red"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 600
          }}
        >
          Delete
        </button>
      </div>
      {error && (
        <div style={{
          color: 'var(--red)',
          fontSize: '11px',
          marginTop: '4px'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
