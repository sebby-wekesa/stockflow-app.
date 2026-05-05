import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import * as jwt from 'jsonwebtoken'
import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const params = await searchParams

  async function login(formData: FormData) {
    'use server'

    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')

    if (!email || !password) {
      redirect('/login?error=' + encodeURIComponent('Email and password are required'))
    }

    const supabase = await createServerSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      redirect('/login?error=' + encodeURIComponent(error.message || 'Login failed'))
    }

    // Get user from database to get role
    const dbUser = await prisma.user.findUnique({
      where: { id: data.user.id },
      select: { role: true, department: true }
    })

    if (!dbUser) {
      redirect('/login?error=' + encodeURIComponent('User not found in database'))
    }

    // Create JWT token
    const token = jwt.sign(
      { role: dbUser.role, department: dbUser.department },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 dark:bg-zinc-950">
      <div className="w-full mx-auto max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          {/* Logo Placeholder */}
          <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
            S
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back to StockFlow
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your work email and password to continue.
          </p>
        </div>

        <LoginForm action={login} error={params.error} message={params.message} />
      </div>
    </div>
  )
}