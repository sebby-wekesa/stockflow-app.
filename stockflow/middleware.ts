import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from '@supabase/ssr'
import { normalizeUserRole } from '@/lib/types'
import { getRoleHomePage } from '@/lib/auth-session'

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('Middleware - Pathname:', pathname);

  // Public routes
  const publicRoutes = ['/login', '/auth/callback', '/auth/auth-code-error']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Skip middleware for API, static, auth routes
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.') || isPublicRoute) {
    return NextResponse.next()
  }

  // Create Supabase client
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

  // Get session
  const { data: { session } } = await supabase.auth.getSession()

  console.log('Middleware - Session exists:', !!session);

  // If no session, redirect to login
  if (!session) {
    console.log('Middleware - No session, redirecting to login');
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Get role from session metadata (already in JWT, no DB query needed)
  const role = normalizeUserRole(session.user.user_metadata?.role)

  // If session exists and on login page, redirect based on role
  if (session && pathname === '/login') {
    console.log('Middleware - On login page, resolved role from session:', role);
    const homePage = getRoleHomePage(role)
    console.log('Middleware - Redirecting to:', homePage);

    // Prevent redirect loop - don't redirect to same path
    if (homePage !== pathname) {
      return NextResponse.redirect(new URL(homePage, request.url))
    }
  }

  // For protected admin routes, check role access (using cached session data)
  if (session && pathname.startsWith('/admin')) {
    console.log('Middleware - Admin route, user role from session:', role);
    if (role !== 'ADMIN') {
      const homePage = getRoleHomePage(role)
      console.log('Middleware - Non-admin, redirecting to:', homePage);
      return NextResponse.redirect(new URL(homePage, request.url))
    }
  }

  // Stage 2: Org status gating
  const orgStatus = session.user.user_metadata?.orgStatus as string | undefined;
  if (orgStatus) {
    if (orgStatus === 'SUSPENDED' && !pathname.startsWith('/account-suspended')) {
      return NextResponse.redirect(new URL('/account-suspended', request.url));
    }
    if (orgStatus === 'CLOSED' && !pathname.startsWith('/account-closed')) {
      return NextResponse.redirect(new URL('/account-closed', request.url));
    }
    if (orgStatus === 'PENDING_APPROVAL' && !pathname.startsWith('/awaiting-approval')) {
      return NextResponse.redirect(new URL('/awaiting-approval', request.url));
    }
  }

  console.log('Middleware - Allowing access');
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};