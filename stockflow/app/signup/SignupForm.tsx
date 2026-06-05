'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { signUpOrganization } from '@/actions/signup'
import { BRANCH_LABELS, ALL_BRANCHES } from '@/lib/branches'

type SignupOrganization = {
  id: string
  name: string
  status: string
}

export function SignupForm({ organizations }: { organizations: SignupOrganization[] }) {
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
        setError((res as any).error)
      } else {
        const email = fd.get('email') as string
        setSubmittedEmail(email)
      }
    })
  }

  if (submittedEmail) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '40px',
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>OK</div>
          <h1 style={{
            fontFamily: 'var(--font-head)',
            fontSize: '24px',
            fontWeight: 800,
            marginBottom: '12px',
            color: 'var(--text)'
          }}>
            Account created
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>
            Your account for{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{submittedEmail}</span>{' '}
            is waiting for an administrator to verify it.
          </p>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: 'transparent',
              border: '1px solid var(--border2)',
              color: 'var(--muted)',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '40px',
        width: '100%',
        maxWidth: '420px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontFamily: 'var(--font-head)',
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '-0.5px',
            marginBottom: '4px'
          }}>
            StockFlow
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--muted)',
            letterSpacing: '1.5px',
            textTransform: 'uppercase'
          }}>
            Manufacturing Platform
          </div>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-head)',
          fontSize: '20px',
          fontWeight: 700,
          marginBottom: '8px',
          color: 'var(--text)'
        }}>
          Create your account
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px', lineHeight: 1.4 }}>
          Choose your organization, then an administrator can verify your account from Users & Roles.
        </p>

        {error && (
          <div style={{
            background: 'rgba(224, 85, 85, 0.12)',
            color: 'var(--red)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            fontSize: '13px',
            border: '1px solid rgba(224, 85, 85, 0.3)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="form-group">
            <label className="form-label">Organization</label>
            <select
              name="organizationId"
              required
              className="form-input"
              disabled={isPending || organizations.length === 0}
              defaultValue=""
            >
              <option value="" disabled>
                {organizations.length === 0 ? 'No organizations available' : 'Select organization'}
              </option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                  {org.status === 'PENDING_APPROVAL' ? ' (pending approval)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Your full name</label>
            <input
              type="text"
              name="fullName"
              required
              minLength={2}
              maxLength={120}
              className="form-input"
              placeholder="Full name"
              disabled={isPending}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Work email</label>
            <input
              type="email"
              name="email"
              required
              className="form-input"
              placeholder="jane@company.com"
              disabled={isPending}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              maxLength={128}
              className="form-input"
              placeholder="At least 8 characters"
              disabled={isPending}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Branch</label>
            <select
              name="branchCode"
              required
              className="form-input"
              disabled={isPending}
              defaultValue=""
            >
              <option value="" disabled>
                Select your branch
              </option>
              {ALL_BRANCHES.map((branch) => (
                <option key={branch} value={branch}>
                  {BRANCH_LABELS[branch]}
                </option>
              ))}
            </select>
          </div>

          <div style={{ position: 'absolute', left: '-9999px', opacity: 0 }}>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </div>

          <button
            type="submit"
            disabled={isPending || organizations.length === 0}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '11px 16px', fontSize: '14px' }}
          >
            {isPending ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
