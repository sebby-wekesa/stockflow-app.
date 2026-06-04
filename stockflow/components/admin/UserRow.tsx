// @ts-nocheck
'use client';

import {
  updateUserRole,
  deleteUser,
  updateUser,
  verifyUser,
  resendInvitation,
  linkAndVerifyAuthUser,
  verifyAuthUserEmail,
} from "@/app/actions/users";
import { useRouter } from "next/navigation";
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
    departments?: string[];
    isVerified?: boolean;
  }
}

export function UserRow({ user }: UserRowProps) {
  const router = useRouter();
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
    const confirmation = window.prompt(
      `Delete ${user.email}?\n\nThis cannot be undone. Type the user's email address to confirm.`
    );

    if (confirmation === null) return;

    if (confirmation.trim().toLowerCase() !== user.email.toLowerCase()) {
      setError("Delete cancelled. Email confirmation did not match.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteUser(user.id);
        if (!result.success) {
          setError(result.error || "Failed to delete user. Please try again.");
          return;
        }
        router.refresh();
      } catch (err) {
        setError((err as Error).message || "Failed to delete user. Please try again.");
      }
    });
  };

  const handleVerify = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await verifyUser(user.id);
        if (!result.success) {
          setError(result.error || "Failed to verify user. Please try again.");
          return;
        }
        router.refresh();
      } catch (err) {
        setError((err as Error).message || "Failed to verify user. Please try again.");
      }
    });
  };

  const handleResendInvitation = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await resendInvitation(user.id);
        if (!result.success) {
          setError(result.error || "Failed to resend invitation.");
          return;
        }
        setError("A new invitation email was sent.");
      } catch (err) {
        setError((err as Error).message || "Failed to resend invitation.");
      }
    });
  };

  const handleEdit = () => {
    const newName = prompt("Enter new name:", user.name || "");
    if (newName === null) return;
    const departments = user.role === 'OPERATOR'
      ? prompt('Enter assigned departments separated by commas:', (user.departments || []).join(', '))
      : '';
    if (departments === null) return;

    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("userId", user.id);
        formData.append("name", newName);
        formData.append("role", user.role);
        formData.append("departments", departments);
        // branchId is now optional
        
        await updateUser(formData);
        window.location.reload();
      } catch (err) {
        console.error(err);
        setError("Failed to update user. Please try again.");
      }
    });
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
          onClick={handleEdit}
          className="btn btn-ghost"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 600
          }}
        >
          Edit
        </button>
        <button
          disabled={isPending || user.isVerified}
          onClick={handleVerify}
          className="btn btn-primary"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 600,
            opacity: user.isVerified ? 0.55 : 1,
            cursor: user.isVerified ? 'default' : 'pointer',
          }}
        >
          {user.isVerified ? 'Verified' : isPending ? 'Verifying...' : 'Verify'}
        </button>
        {!user.isVerified && (
          <button
            disabled={isPending}
            onClick={handleResendInvitation}
            className="btn btn-ghost"
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600
            }}
          >
            {isPending ? 'Sending...' : 'Resend invite'}
          </button>
        )}
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

export function AuthOnlyUserRow({
  user,
}: {
  user: {
    id: string;
    email: string;
    name: string | null;
    isVerified: boolean;
    linkStatus?: "UNLINKED" | "LINKED_ELSEWHERE";
    organizationName?: string | null;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleLinkAndVerify = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await linkAndVerifyAuthUser(user.id);
        if (!result.success) {
          setError(result.error || "Failed to add and verify user.");
          return;
        }
        router.refresh();
      } catch (err) {
        setError((err as Error).message || "Failed to add and verify user.");
      }
    });
  };

  const handleVerifyOnly = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await verifyAuthUserEmail(user.id);
        if (!result.success) {
          setError(result.error || "Failed to verify user.");
          return;
        }
        router.refresh();
      } catch (err) {
        setError((err as Error).message || "Failed to verify user.");
      }
    });
  };

  const isLinkedElsewhere = user.linkStatus === "LINKED_ELSEWHERE";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
      {isLinkedElsewhere ? (
        <button
          disabled={isPending || user.isVerified}
          onClick={handleVerifyOnly}
          className="btn btn-ghost"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 600,
            opacity: user.isVerified ? 0.55 : 1,
          }}
        >
          {user.isVerified ? 'Verified' : isPending ? 'Verifying...' : 'Verify email'}
        </button>
      ) : (
        <button
          disabled={isPending}
          onClick={handleLinkAndVerify}
          className="btn btn-primary"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 600
          }}
        >
          {isPending ? 'Adding...' : 'Add & Verify'}
        </button>
      )}
      {isLinkedElsewhere && (
        <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
          Linked to {user.organizationName || 'another organization'}
        </div>
      )}
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
