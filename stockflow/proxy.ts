import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { normalizeUserRole } from '@/lib/types'
import { getRoleHomePage } from '@/lib/auth-session'

/**
 * Routes that don't need a session.
 *
 * Includes the new multitenancy signup/approval routes added in Stage 2.
 */
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/auth/callback',
  '/auth/auth-code-error',
  '/accept-invite',
  '/forgot-password',
  '/reset-password',
  '/set-password',
]

/**
 * Routes a logged-in user can visit regardless of their org status.
 * Used for status-pending users to see the waiting screen, etc.
 */
const STATUS_ROUTES = [
  '/awaiting-approval',
  '/account-suspended',
  '/account-closed',
  '/signup',
  '/accept-invite',
  '/set-password',
]

type OrganizationStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED'

type UserContextRow = {
  role?: string | null
  Organization?: {
    status?: OrganizationStatus | null
  } | null
}

const ROUTE_ROLE_RULES: Array<{ paths: string[]; roles: string[] }> = [
  { paths: ['/users'], roles: ['ADMIN'] },
  { paths: ['/reports', '/analytics', '/scrap'], roles: ['ADMIN', 'MANAGER'] },
  { paths: ['/approvals', '/manager', '/manager_dash'], roles: ['ADMIN', 'MANAGER'] },
  { paths: ['/operator', '/operator_queue', '/operator_log', '/operator_history', '/stage-logger'], roles: ['OPERATOR', 'ADMIN', 'MANAGER'] },
  { paths: ['/packaging', '/pack_queue', '/pack_done'], roles: ['PACKAGING', 'ADMIN', 'MANAGER'] },
  { paths: ['/sales', '/sales-orders', '/catalogue', '/customers'], roles: ['SALES', 'ADMIN', 'MANAGER'] },
  { paths: ['/rawmaterials', '/receive', '/inventory', '/stock', '/warehouse', '/products', '/finishedgoods'], roles: ['WAREHOUSE', 'ADMIN', 'MANAGER'] },
  { paths: ['/designs', '/jobs', '/orders', '/production', '/place_order', '/departments', '/settings/branches'], roles: ['ADMIN', 'MANAGER'] },
  { paths: ['/import'], roles: ['ADMIN', 'WAREHOUSE'] },
]

function pathMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
}

function createNonce(): string {
  return btoa(crypto.randomUUID())
}

function createForwardedHeaders(request: NextRequest, nonce: string, csp: string): Headers {
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set('x-nonce', nonce)
  forwardedHeaders.set('Content-Security-Policy', csp)
  return forwardedHeaders
}

function applySecurityHeaders(response: NextResponse, nonce: string, csp: string): NextResponse {
  response.headers.set('x-nonce', nonce)
  if (process.env.CSP_REPORT_ONLY === '1') {
    response.headers.set('Content-Security-Policy-Report-Only', csp)
  } else {
    response.headers.set('Content-Security-Policy', csp)
  }

  return response
}

async function resolveUserContext(userId: string, fallbackRole?: string) {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return { role: normalizeUserRole(fallbackRole), orgStatus: 'ACTIVE' as const }
  }

  try {
    // Look up the user's role AND their org's status in one query.
    // We hit the Prisma User + Organization tables here instead of profiles.
    const { data, error } = await supabaseAdmin
      .from('User')
      .select('role, Organization (status)')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('User context lookup failed:', error)
      return { role: normalizeUserRole(fallbackRole), orgStatus: 'ACTIVE' as const }
    }

    const userContext = data as UserContextRow | null
    const orgStatus = userContext?.Organization?.status ?? 'ACTIVE'
    return {
      role: normalizeUserRole(userContext?.role ?? fallbackRole),
      orgStatus,
    }
  } catch (error) {
    console.error('User context lookup error:', error)
    return { role: normalizeUserRole(fallbackRole), orgStatus: 'ACTIVE' as const }
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const nonce = createNonce()
  const csp = buildCsp(nonce)

  // Skip auth/routing logic for API routes, static assets, and Next.js
  // internals, but still attach CSP to the response.
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return applySecurityHeaders(
      NextResponse.next({
        request: { headers: createForwardedHeaders(request, nonce, csp) },
      }),
      nonce,
      csp
    )
  }

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  const isStatusRoute = STATUS_ROUTES.some(route => pathname.startsWith(route))

  // Create Supabase client to read session cookies
  const response = NextResponse.next({
    request: { headers: createForwardedHeaders(request, nonce, csp) },
  })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // No session / invalid token
  if (!user) {
    if (isPublicRoute) {
      return applySecurityHeaders(response, nonce, csp) // allow access
    }
    // Redirect to login, preserving the intended destination
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce, csp)
  }

  // Has a valid user - look up role and org status
  const ctx = await resolveUserContext(
    user.id,
    user.user_metadata?.role
  )

  // Hard blocks: SUSPENDED or CLOSED orgs cannot do anything except see the
  // explanation page and log out
  if (ctx.orgStatus === 'SUSPENDED') {
    if (pathname === '/account-suspended' || pathname === '/login') {
      return applySecurityHeaders(response, nonce, csp)
    }
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/account-suspended', request.url)),
      nonce,
      csp
    )
  }
  if (ctx.orgStatus === 'CLOSED') {
    if (pathname === '/account-closed' || pathname === '/login') {
      return applySecurityHeaders(response, nonce, csp)
    }
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/account-closed', request.url)),
      nonce,
      csp
    )
  }

  // PENDING_APPROVAL users can only see the waiting screen and log out
  if (ctx.orgStatus === 'PENDING_APPROVAL') {
    if (pathname === '/awaiting-approval' || pathname === '/login') {
      return applySecurityHeaders(response, nonce, csp)
    }
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/awaiting-approval', request.url)),
      nonce,
      csp
    )
  }

  // ACTIVE org from here on

  // On /login while logged in -> bounce to their home page
  if (pathname === '/login') {
    const homePage = getRoleHomePage(ctx.role)
    if (homePage !== pathname) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL(homePage, request.url)),
        nonce,
        csp
      )
    }
  }

  // On status routes while ACTIVE -> no need, send to dashboard
  if (isStatusRoute && pathname !== '/signup') {
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/dashboard', request.url)),
      nonce,
      csp
    )
  }

  // Admin route protection
  if (pathname.startsWith('/admin') && ctx.role !== 'ADMIN') {
    const homePage = getRoleHomePage(ctx.role)
    return applySecurityHeaders(
      NextResponse.redirect(new URL(homePage, request.url)),
      nonce,
      csp
    )
  }

  const routeRule = ROUTE_ROLE_RULES.find(rule =>
    rule.paths.some(path => pathMatches(pathname, path))
  )
  if (routeRule && !routeRule.roles.includes(ctx.role)) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL(getRoleHomePage(ctx.role), request.url)),
      nonce,
      csp
    )
  }

  return applySecurityHeaders(response, nonce, csp)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
