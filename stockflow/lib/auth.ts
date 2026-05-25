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

// Use the direct (non-pooled) client for auth lookups — much more reliable
const prisma = authPrisma;
import { type UserRole } from "./types";
import type { OrgStatus } from "@prisma/client";

export type Role = UserRole;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  department: string | null;
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
    if (!prisma.user) {
      console.error("User model not available in Prisma client");
      return null;
    }

    // Use raw query for the User row to avoid any ORM relation or field validation issues
    // caused by schema drift between the generated client and the actual DB.
    const [rawUser] = await withRetry(() =>
      prisma.$queryRawUnsafe(
        `SELECT 
           id, 
           email, 
           name, 
           role, 
           department, 
           "organizationId", 
           "branchId" 
         FROM "User" 
         WHERE id = $1 
         LIMIT 1`,
        authUser.id
      )
    ) as any[];

    if (!rawUser) {
      console.log("User not found in database for ID:", authUser.id);
      return null;
    }

    // Fetch Organization separately (minimal, no relations)
    const organization = await withRetry(() =>
      prisma.organization.findUnique({
        where: { id: rawUser.organizationid || rawUser.organizationId },
        select: { id: true, name: true, slug: true, status: true },
      })
    );

    if (!organization) {
      console.warn("User has no organization linked:", rawUser.id);
      return null;
    }

    // Lightweight Branch fetch (optional)
    let branch = null;
    const branchId = rawUser.branchid || rawUser.branchId;
    if (branchId) {
      branch = await withRetry(() =>
        prisma.branch.findUnique({
          where: { id: branchId },
          select: { id: true, name: true },
        })
      );
    }

    // Hard gate: SUSPENDED and CLOSED orgs cannot access the app at all
    if (organization.status === 'SUSPENDED' || organization.status === 'CLOSED') {
      return null;
    }
    // PENDING_APPROVAL users CAN be returned (so pages can show the
    // waiting screen), but most actions will check status === 'ACTIVE'

    return {
      id: rawUser.id,
      email: rawUser.email,
      name: rawUser.name ?? "",
      role: rawUser.role,
      department: rawUser.department,
      branches: branch ? [{ id: branch.id, name: branch.name }] : [],
      organizationId: organization.id,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
      },
    };
  } catch (error: any) {
    console.error("Prisma lookup failed in getUser:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
      stack: error?.stack?.slice(0, 500),
    });
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
