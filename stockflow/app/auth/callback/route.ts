import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getRoleHomePage, resolveUserRole, setAuthCookies } from '@/lib/auth-session'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Change the default from /admin/dashboard to /dashboard
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.session && data.user) {
      const role = await resolveUserRole(data.user.id, data.user.user_metadata?.role)
      setAuthCookies(cookieStore, data.session, role)

      const destination = next === '/dashboard' ? getRoleHomePage(role) : next
      const response = NextResponse.redirect(`${origin}${destination}`)

      return response
    }
  }

  // Return the user to an error page or login if it fails
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
