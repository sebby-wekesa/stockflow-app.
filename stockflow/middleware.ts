import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from '@supabase/ssr'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { normalizeUserRole } from '@/lib/types'
import { getRoleHomePage } from '@/lib/auth-session'

// Helper function to resolve user role
async function resolveUserRole(userId: string, fallbackRole?: string) {
  const supabaseAdmin = getSupabaseAdmin()

  if (!supabaseAdmin) {
    return normalizeUserRole(fallbackRole)
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      console.error("Profile lookup failed:", error)
    }

    return normalizeUserRole(data?.role ?? fallbackRole)
  } catch (error) {
    console.error("Profile lookup error:", error)
    return normalizeUserRole(fallbackRole)
  }
}

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

  // If session exists and on login page, redirect based on role
  if (session && pathname === '/login') {
    try {
      console.log('Middleware - On login page, resolving role');
      const role = await resolveUserRole(session.user.id, session.user.user_metadata?.role)
      console.log('Middleware - Resolved role:', role);
      const homePage = getRoleHomePage(role)
      console.log('Middleware - Redirecting to:', homePage);

      // Prevent redirect loop - don't redirect to same path
      if (homePage !== pathname) {
        return NextResponse.redirect(new URL(homePage, request.url))
      }
    } catch (error) {
      console.error('Role resolution failed:', error)
      // Allow access to dashboard even if role resolution fails temporarily
      if (pathname === '/login') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  // For protected routes, check role access
  if (session && pathname.startsWith('/admin')) {
    try {
      const role = await resolveUserRole(session.user.id, session.user.user_metadata?.role)
      console.log('Middleware - Admin route, user role:', role);
      if (role !== 'ADMIN') {
        const homePage = getRoleHomePage(role)
        console.log('Middleware - Non-admin, redirecting to:', homePage);
        return NextResponse.redirect(new URL(homePage, request.url))
      }
    } catch (error) {
      console.error('Role check failed:', error)
      // Allow temporary access if role check fails
      return response
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