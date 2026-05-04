'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Something went wrong')
          return
        }

        // Redirect to login on success
        router.push('/login?message=' + encodeURIComponent('Account created successfully. Please check your email for verification.'))
      } catch (err) {
        setError('Network error. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="fullName" className="block text-xs uppercase tracking-wider text-muted mb-2">
          Full Name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          className="input w-full"
          placeholder="John Doe"
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
          placeholder="you@company.com"
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
          className="input w-full"
          placeholder="••••••••"
          minLength={8}
        />
        <p className="text-xs text-muted mt-1">
          Must be at least 8 characters long
        </p>
      </div>

      <button type="submit" disabled={isPending} className="btn btn-primary w-full">
        {isPending ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  )
}