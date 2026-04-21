import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

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

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  let user: UserClaims | null = null;

  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET) as UserClaims;
    } catch {
      // Invalid token
    }
  }

  const { pathname } = request.nextUrl;

  // Public routes
  const publicRoutes = ['/login', '/api/auth'];
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Require authentication for all other routes
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { role, department } = user;

  // Admin has full access
  if (role === 'ADMIN') {
    return NextResponse.next();
  }

  // Check if user has permission for the path
  const allowedPaths = rolePermissions[role] || [];
  const hasAccess = allowedPaths.includes('*') || allowedPaths.some(path => pathname.startsWith(path));

  if (!hasAccess) {
    // Redirect to appropriate dashboard
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