import { NextResponse } from 'next/server'
import { clearAuthCookies } from '@/lib/auth-session'

export async function POST() {
  const response = NextResponse.redirect('/login', { status: 302 })
  clearAuthCookies(response.cookies)

  return response
}
