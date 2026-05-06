'use client'

import { useFormStatus } from 'react-dom'
import Link from 'next/link'

interface LoginFormProps {
  action: (formData: FormData) => Promise<void>
  error?: string
  message?: string
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? 'Signing in...' : 'Sign in'}
    </button>
  )
}

export function LoginForm({ action, error, message }: LoginFormProps) {
  return (
    <>
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-5">
          {error}
        </div>
      )}

      {message && (
        <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm mb-5">
          {message}
        </div>
      )}

      <form action={action} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs uppercase tracking-wider text-muted font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input w-full py-2.5"
            placeholder="you@springtech.co.ke"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs uppercase tracking-wider text-muted font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input w-full py-2.5"
            placeholder="••••••••"
          />
        </div>

        <div className="pt-1">
          <SubmitButton />
        </div>
      </form>

      <div className="mt-7 pt-6 border-t border-border text-center text-sm text-muted space-y-2">
        <div>
          <Link href="/forgot-password" className="text-accent hover:underline">
            Forgot your password?
          </Link>
        </div>
        <div>
          Need an account?{' '}
          <Link href="/signup" className="text-accent hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </>
  )
}