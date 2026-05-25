/**
 * Tenant context — sets the Postgres session variable `app.current_org_id`
 * so the Row-Level Security policies can filter rows by organization.
 *
 * USAGE:
 *
 *   // In a Server Action or Server Component:
 *   import { getTenantContext, withTenant } from '@/lib/tenant'
 *
 *   const ctx = await getTenantContext()
 *   // ctx = { user, organizationId, role }
 *
 *   // For DB queries that need RLS enforcement:
 *   const products = await withTenant(ctx, async () => {
 *     return prisma.product.findMany()
 *     // RLS automatically filters to ctx.organizationId
 *   })
 *
 * NOTES:
 *   - withTenant uses an interactive transaction so the SET LOCAL only
 *     affects the queries inside it.
 *   - If the user has no org or org is not ACTIVE, throws an error.
 *   - The `app.current_org_id` variable defaults to NULL outside withTenant,
 *     which means RLS returns 0 rows — so accidental queries outside the
 *     tenant context fail safely instead of leaking data.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { authPrisma } from '@/lib/prisma'

// Use direct (non-pooled) client for user lookups to avoid pooler timeouts
const prisma = authPrisma
import type { User, Organization } from '@prisma/client'

/**
 * The shape of user data we actually fetch for tenant context.
 * We deliberately use a limited select for performance + resilience
 * against schema drift / pooler issues.
 */
export type TenantUser = Pick<
  User,
  'id' | 'email' | 'name' | 'role' | 'department' | 'organizationId'
> & {
  Organization: Pick<Organization, 'id' | 'name' | 'slug' | 'status'> | null
}

export type TenantContext = {
  user: TenantUser
  organization: Pick<Organization, 'id' | 'name' | 'slug' | 'status'>
  organizationId: string
  role: User['role']
}

/**
 * Look up the current user and their organization. If the user is not logged
 * in, redirects to /login. If their org is not active, redirects to a
 * suspended-org page.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {}, // read-only in Server Components
        remove: () => {},
      },
    }
  )

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      organizationId: true,
      Organization: {
        select: { id: true, name: true, slug: true, status: true },
      },
    },
  })

  if (!user) {
    // Authenticated but not provisioned — sign them out and redirect to signup
    redirect('/signup?error=not-provisioned')
  }

  if (!user.Organization) {
    redirect('/signup?error=no-organization')
  }

  // Org status gating
  if (user.Organization.status === 'SUSPENDED') {
    redirect('/account-suspended')
  }
  if (user.Organization.status === 'CLOSED') {
    redirect('/account-closed')
  }
  if (user.Organization.status === 'PENDING_APPROVAL') {
    redirect('/awaiting-approval')
  }

  return {
    user: user as TenantUser,
    organization: user.Organization!,
    organizationId: user.Organization!.id,
    role: user.role,
  }
}

/**
 * Run a callback within a tenant-scoped Prisma transaction. Sets the
 * `app.current_org_id` Postgres session variable so RLS policies apply.
 *
 * Use this for any read or write that should respect tenant isolation
 * — which is almost all queries. Exceptions: signup itself, system-level
 * background jobs, and migrations.
 */
export async function withTenant<T>(
  ctx: TenantContext | { organizationId: string },
  fn: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Set the session variable for the duration of this transaction.
    // Using SET LOCAL so it auto-resets at commit/rollback.
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_org_id = '${ctx.organizationId.replace(/'/g, "''")}'`
    )
    return fn(tx as typeof prisma)
  })
}

/**
 * Role gate. Use after getTenantContext().
 *
 *   const ctx = await getTenantContext()
 *   requireTenantRole(ctx, ['ADMIN', 'MANAGER'])
 */
export function requireTenantRole(
  ctx: TenantContext,
  allowed: Array<TenantContext['role']>
): void {
  if (!allowed.includes(ctx.role)) {
    throw new Error(
      `Forbidden: this action requires one of [${allowed.join(', ')}], you are ${ctx.role}`
    )
  }
}

/**
 * Non-redirecting variant. Returns null instead of redirecting if the user
 * isn't logged in or their org isn't ready. Useful for layouts that render
 * for both logged-in and logged-out states, or for API routes that should
 * return a 401/403 JSON response rather than a redirect.
 */
export async function getTenantContextOrNull(): Promise<TenantContext | null> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      }
    )

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) return null

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        organizationId: true,
        Organization: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    })

    if (!user || !user.Organization) return null
    if (user.Organization.status !== 'ACTIVE') return null

    return {
      user: user as TenantUser,
      organization: user.Organization!,
      organizationId: user.Organization!.id,
      role: user.role,
    }
  } catch {
    return null
  }
}
