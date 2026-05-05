import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string }
}) {
  async function login(formData: FormData) {
    'use server'

    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')

    if (!email || !password) {
      redirect('/login?error=' + encodeURIComponent('Email and password are required'))
    }

    const supabase = createServerSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      redirect('/login?error=' + encodeURIComponent(error.message))
    }

    redirect('/dashboard')
  }

  return (
    <div className="card p-8">
      <h1 className="font-head text-2xl font-bold mb-1">Sign in</h1>
      <p className="text-muted text-sm mb-6">
        Enter your work email and password to continue.
      </p>

      {searchParams.error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {searchParams.error}
        </div>
      )}

      {searchParams.message && (
        <div className="mb-4 p-3 rounded-md bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm">
          {searchParams.message}
        </div>
      )}

      <form action={login} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs uppercase tracking-wider text-muted mb-2">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input w-full"
            placeholder="you@springtech.co.ke"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs uppercase tracking-wider text-muted mb-2">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input w-full"
            placeholder="••••••••"
          />
        </div>

        <button type="submit" className="btn btn-primary w-full">
          Sign in
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted">
        Need an account?{' '}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </div>
    </div>
  )
}
