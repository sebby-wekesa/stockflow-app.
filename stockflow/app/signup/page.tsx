'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { signUpOrganization } from '@/actions/signup'

export default function SignupPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await signUpOrganization(fd)
      if ('error' in res) {
        setError(res.error)
      } else {
        setSubmittedEmail(res.email)
      }
    })
  }

  if (submittedEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="card p-8 max-w-md w-full">
          <div className="text-4xl mb-4 text-center">📧</div>
          <h1 className="font-head text-2xl font-bold mb-3 text-center">
            Check your inbox
          </h1>
          <p className="text-muted text-sm mb-6 text-center leading-relaxed">
            We sent a confirmation link to{' '}
            <span className="font-mono text-text">{submittedEmail}</span>.
            Click the link to verify your email.
          </p>
          <p className="text-xs text-muted text-center mb-6">
            After verification, your organization will be reviewed by an
            administrator. You&apos;ll get a second email once you&apos;re approved
            — usually within one business day.
          </p>
          <Link href="/login" className="btn btn-ghost w-full text-center">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="card p-8 max-w-md w-full">
        <h1 className="font-head text-2xl font-bold mb-2">Create your organization</h1>
        <p className="text-muted text-sm mb-6">
          Sign your company up for StockFlow. We&apos;ll review your account
          and approve it within one business day.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Company name
            </label>
            <input
              type="text"
              name="organizationName"
              required
              minLength={2}
              maxLength={120}
              className="input w-full"
              placeholder="Acme Springs Ltd"
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Your full name
            </label>
            <input
              type="text"
              name="fullName"
              required
              minLength={2}
              maxLength={120}
              className="input w-full"
              placeholder="Jane Doe"
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Work email
            </label>
            <input
              type="email"
              name="email"
              required
              className="input w-full"
              placeholder="jane@acmesprings.co.ke"
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Phone (optional)
            </label>
            <input
              type="tel"
              name="phone"
              maxLength={40}
              className="input w-full"
              placeholder="+254 ..."
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              maxLength={128}
              className="input w-full"
              placeholder="At least 8 characters"
              disabled={isPending}
            />
            <p className="text-xs text-muted mt-1">
              Use at least 8 characters. You&apos;ll need to verify your email
              before signing in.
            </p>
          </div>

          {/* Honeypot — hidden from real users, visible to bots */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-10000px',
              top: 'auto',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            <label>
              Website (leave blank)
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary w-full"
          >
            {isPending ? 'Creating account...' : 'Create organization'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
