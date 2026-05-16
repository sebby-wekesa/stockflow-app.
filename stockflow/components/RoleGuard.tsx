// components/RoleGuard.tsx
import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import type { UserRole as Role } from '@/lib/types';

export async function RoleGuard({
  children,
  allowedRoles
}: {
  children: ReactNode,
  allowedRoles: Role[]
}) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  if (!allowedRoles.includes(user.role)) {
    // This will show the permission denied page
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400">403 — Unauthorized</h1>
          <p className="text-zinc-400 mt-2">
            You do not have permission to view this page.
            {user ? ` Your current role: ${user.role}` : ' Please log in.'}
          </p>
          <div className="mt-6">
            <a href="/dashboard" className="btn btn-primary">
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
