import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  async function signup(formData: FormData) {
    'use server'

    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    const fullName = String(formData.get('full_name') ?? '').trim()

    if (!email || !password || !fullName) {
      redirect('/signup?error=' + encodeURIComponent('All fields are required'))
    }

    if (password.length < 8) {
      redirect('/signup?error=' + encodeURIComponent('Password must be at least 8 characters'))
    }

    // Check if this is the first user — they become admin
    const existingUserCount = await prisma.user.count()
    const isFirstUser = existingUserCount === 0

    if (!isFirstUser) {
      redirect(
        '/signup?error=' +
          encodeURIComponent(
            'Self-signup is disabled. Ask your admin to create an account for you.'
          )
      )
    }

    const supabase = createServerSupabase()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: { full_name: fullName },
      },
    })

    if (error) {
      redirect('/signup?error=' + encodeURIComponent(error.message))
    }

    if (!data.user) {
      redirect('/signup?error=' + encodeURIComponent('Signup failed — please try again'))
    }

    // First user — bootstrap the org and the admin user record
    let org = await prisma.organisation.findFirst()
    if (!org) {
      org = await prisma.organisation.create({
        data: { name: 'Springtech (K) Ltd' },
      })
    }

    await prisma.user.create({
      data: {
        id: data.user.id,
        org_id: org.id,
        email,
        full_name: fullName,
        role: 'admin',
        branches: ['mombasa', 'nairobi', 'bonje'],
      },
    })

    redirect('/login?message=' + encodeURIComponent('Account created. Please sign in.'))
  }

  return (
    <div className="card p-8">
      <h1 className="font-head text-2xl font-bold mb-1">Create admin account</h1>
      <p className="text-muted text-sm mb-6">
        First-time setup. Subsequent users are added by the admin.
      </p>

      {searchParams.error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {searchParams.error}
        </div>
      )}

      <form action={signup} className="space-y-4">
        <div>
          <label htmlFor="full_name" className="block text-xs uppercase tracking-wider text-muted mb-2">
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            className="input w-full"
            placeholder="Sarah Owino"
          />
        </div>

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
            placeholder="sarah@springtech.co.ke"
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
            autoComplete="new-password"
            minLength={8}
            className="input w-full"
            placeholder="At least 8 characters"
          />
        </div>

        <button type="submit" className="btn btn-primary w-full">
          Create account
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  )
}
