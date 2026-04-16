import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const userRole = request.cookies.get('user-role')?.value; // In a real app, use a JWT/Auth session
  const { pathname } = request.nextUrl;

  // Protect Admin Routes
  if (pathname.startsWith('/admin') && userRole !== 'ADMIN') {
    return NextResponse.redirect(new URL('/operator/queue', request.url));
  }

  // Protect Operator Routes
  if (pathname.startsWith('/operator') && userRole === 'ADMIN') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
}