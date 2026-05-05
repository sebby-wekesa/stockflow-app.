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
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="p-3 rounded-md bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm">
          {message}
        </div>
      )}

      <form action={action} className="space-y-4">
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

        <SubmitButton />
      </form>

      <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted">
        <div className="mb-2">
          <Link href="/forgot-password" className="text-accent hover:underline">
            Forgot your password?
          </Link>
        </div>
        Need an account?{' '}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </div>
    </>
  )
}