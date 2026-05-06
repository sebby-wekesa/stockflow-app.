import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jwt from 'jsonwebtoken';

type UserClaims = {
  role: string;
  department?: string;
};

const rolePermissions: Record<string, string[]> = {
  ADMIN: ['*'], // full access
  MANAGER: ['/manager_dash', '/approvals', '/orders', '/departments', '/scrap', '/rawmaterials'],
  OPERATOR: ['/operator_queue', '/operator_log'],
  SALES: ['/catalogue', '/place_order', '/my_orders'],
  PACKAGING: ['/pack_queue', '/pack_done'],
  WAREHOUSE: ['/receive', '/rawmaterials']
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, images, and system files
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('/static/') ||
    pathname.includes('.') // Catches .js, .css, .ico, .png, etc.
  ) {
    return NextResponse.next();
  }

  // API routes handle their own authentication
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Allow unauthenticated access to login and signup
  if (pathname === '/login' || pathname === '/signup') {
    return NextResponse.next();
  }

  // Resolve JWT_SECRET at runtime (not module load time) to avoid crashes
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    console.error('[proxy] JWT_SECRET is not set — redirecting to /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check for auth token
  const token = request.cookies.get('auth-token')?.value;
  let user: UserClaims | null = null;

  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET) as UserClaims;
    } catch {
      // Invalid or expired token — treat as unauthenticated
    }
  }

  // Require authentication for all other routes
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { role } = user;

  // Admin has full access
  if (role === 'ADMIN') {
    return NextResponse.next();
  }

  // Check if user has permission for the path
  const allowedPaths = rolePermissions[role] || [];
  const hasAccess = allowedPaths.includes('*') || allowedPaths.some(path => pathname.startsWith(path));

  if (!hasAccess) {
    // Redirect to appropriate dashboard for the role
    const redirectMap: Record<string, string> = {
      MANAGER: '/manager_dash',
      OPERATOR: '/operator_queue',
      SALES: '/catalogue',
      PACKAGING: '/pack_queue',
      WAREHOUSE: '/receive'
    };
    const redirectTo = redirectMap[role] || '/login';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}