import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from '@supabase/ssr'
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
  '/forgot-password',
  '/reset-password',
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
]

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

    const orgStatus = (data as any)?.Organization?.status ?? 'ACTIVE'
    return {
      role: normalizeUserRole((data as any)?.role ?? fallbackRole),
      orgStatus: orgStatus as 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED',
    }
  } catch (error) {
    console.error('User context lookup error:', error)
    return { role: normalizeUserRole(fallbackRole), orgStatus: 'ACTIVE' as const }
  }
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes, static assets, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  const isStatusRoute = STATUS_ROUTES.some(route => pathname.startsWith(route))

  // Create Supabase client to read session cookies
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // No session
  if (!session) {
    if (isPublicRoute) {
      return response // allow access
    }
    // Redirect to login, preserving the intended destination
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Has a session — look up role and org status
  const ctx = await resolveUserContext(
    session.user.id,
    session.user.user_metadata?.role
  )

  // Hard blocks: SUSPENDED or CLOSED orgs cannot do anything except see the
  // explanation page and log out
  if (ctx.orgStatus === 'SUSPENDED') {
    if (pathname === '/account-suspended' || pathname === '/login') {
      return response
    }
    return NextResponse.redirect(new URL('/account-suspended', request.url))
  }
  if (ctx.orgStatus === 'CLOSED') {
    if (pathname === '/account-closed' || pathname === '/login') {
      return response
    }
    return NextResponse.redirect(new URL('/account-closed', request.url))
  }

  // PENDING_APPROVAL users can only see the waiting screen and log out
  if (ctx.orgStatus === 'PENDING_APPROVAL') {
    if (pathname === '/awaiting-approval' || pathname === '/login') {
      return response
    }
    return NextResponse.redirect(new URL('/awaiting-approval', request.url))
  }

  // ACTIVE org from here on

  // On /login while logged in → bounce to their home page
  if (pathname === '/login') {
    const homePage = getRoleHomePage(ctx.role)
    if (homePage !== pathname) {
      return NextResponse.redirect(new URL(homePage, request.url))
    }
  }

  // On status routes while ACTIVE → no need, send to dashboard
  if (isStatusRoute && pathname !== '/signup') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Admin route protection
  if (pathname.startsWith('/admin') && ctx.role !== 'ADMIN') {
    const homePage = getRoleHomePage(ctx.role)
    return NextResponse.redirect(new URL(homePage, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
