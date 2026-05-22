/**
 * Super-admin gate.
 *
 * In this multitenant app, "super admin" means YOU — the platform operator
 * (Springtech / Fortune Path) — not an admin of any particular tenant org.
 * Super admins can approve new orgs, suspend them, view all data across
 * tenants, etc.
 *
 * Identity: defined by the `SUPER_ADMIN_EMAILS` env var (comma-separated).
 * Set this to your own email(s) on the deployment.
 *
 *   SUPER_ADMIN_EMAILS=inder@fortunepath.co.ke,ops@fortunepath.co.ke
 *
 * If unset, no super-admin operations are possible. This is intentional —
 * unset env var = locked down by default.
 */

import { requireAuth, type AuthUser } from '@/lib/auth'

function getSuperAdminEmails(): Set<string> {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? ''
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isSuperAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  const admins = getSuperAdminEmails()
  return admins.has(user.email.toLowerCase())
}

export async function requireSuperAdmin(): Promise<AuthUser> {
  // Note: this uses requireAuth (NOT requireActiveAuth) because the super
  // admin themselves might belong to an org that's PENDING_APPROVAL —
  // weird edge case but possible during dev. Super admin status overrides.
  const user = await requireAuth()
  if (!isSuperAdmin(user)) {
    throw new Error('Forbidden: super admin access required')
  }
  return user
}
