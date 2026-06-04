/**
 * Backward-compatible auth helpers.
 *
 * Legacy API (still works):
 *   - getUser()           → AuthUser | null
 *   - requireAuth()       → AuthUser  (throws if not logged in)
 *   - requireRole(...r)   → AuthUser  (throws if wrong role)
 *   - checkRole(user, ...) → boolean
 *
 * What's new (Stage 2):
 *   The AuthUser object now includes `organizationId`. Existing code paths
 *   that just read `.role`, `.id`, `.email` keep working. Code that needs
 *   tenant-aware DB queries should switch to:
 *     import { getTenantContext, withTenant } from '@/lib/tenant'
 *
 *   But this file is kept as the easy on-ramp.
 *
 * Status gating:
 *   getUser() returns null if the user's org is SUSPENDED or CLOSED.
 *   PENDING_APPROVAL users get returned but their `orgStatus` is set so
 *   pages can show an "awaiting approval" message.
 */

import { supabaseServerComponent } from "./supabase-admin";
import { authPrisma, withRetry } from "./prisma";
import { type UserRole } from "./types";
import type { OrgStatus } from "@prisma/client";

export type Role = UserRole;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  department: string | null;
  departments: string[];
  branches: { id: string; name: string }[];
  // New in Stage 2 — multitenancy
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    status: OrgStatus;
  };
};

export async function getUser(): Promise<AuthUser | null> {
  const supabase = await supabaseServerComponent();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) return null;

  try {
    // Use the shared Prisma singleton for auth lookups. Wrap calls
    // with withRetry to tolerate transient pooler errors in dev.
    if (!authPrisma || !authPrisma.user) {
      console.error("Auth Prisma client or User model not available");
      return null;
    }

    let user: any = null
    try {
      user = await withRetry(() => authPrisma.user.findUnique({
        where: { id: authUser.id },
        include: {
          Branch: true,
          Organization: {
            select: { id: true, name: true, slug: true, status: true },
          },
        },
      }), undefined)
    } catch (e: any) {
      console.error('authPrisma lookup failed:', e?.message || e)
      return null
    }


    if (!user) {
      console.log("User not found in database for ID:", authUser.id);
      return null;
    }

    if (!user.Organization) {
      console.warn("User has no organization linked:", user.id);
      return null;
    }

    // Hard gate: SUSPENDED and CLOSED orgs cannot access the app at all
    if (user.Organization.status === 'SUSPENDED' || user.Organization.status === 'CLOSED') {
      return null;
    }
    // PENDING_APPROVAL users CAN be returned (so pages can show the
    // waiting screen), but most actions will check status === 'ACTIVE'

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? "",
      role: user.role,
      department: user.department ?? null,
      departments: user.departments?.length
        ? user.departments
        : user.department
          ? [user.department]
          : [],
      branches: user.Branch ? [{ id: user.Branch.id, name: user.Branch.name }] : [],
      organizationId: user.Organization.id,
      organization: {
        id: user.Organization.id,
        name: user.Organization.name,
        slug: user.Organization.slug,
        status: user.Organization.status,
      },
    };
  } catch (error) {
    console.error("Prisma lookup failed:", error);
    return null;
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Requires the user to have ACTIVE org status (not pending, suspended, or closed).
 * Most server actions should use this.
 */
export async function requireActiveAuth(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.organization.status !== 'ACTIVE') {
    throw new Error(`Organization is ${user.organization.status.toLowerCase().replace('_', ' ')}`);
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<AuthUser> {
  const user = await requireActiveAuth();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }
  return user;
}

export async function checkRole(user: AuthUser | null, ...roles: Role[]): Promise<boolean> {
  if (!user) return false;
  return roles.includes(user.role);
}
