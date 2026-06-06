"use client";

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/actions/auth';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const res = await signIn(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res && typeof res === 'object' && 'success' in res && res.success === true) {
        // Success - wait a moment for session to be established, then redirect
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);
        return;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-main)',
        padding: '40px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontFamily: 'var(--font-headings)',
            fontSize: '24px',
            fontWeight: '800',
            color: 'var(--accent-amber)',
            letterSpacing: '-0.5px',
            marginBottom: '4px'
          }}>
            SpringTech(K)Ltd
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: 'rgba(224, 85, 85, 0.15)',
              color: 'var(--red)',
              padding: '12px',
              borderRadius: 'var(--radius-small)',
              marginBottom: '16px',
              fontSize: '14px',
              border: '1px solid rgba(224, 85, 85, 0.3)'
            }}>
              {error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="your.email@company.com"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '16px' }}
          >
            Sign In
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <a
            href="/signup"
            className="btn btn-secondary"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px 16px',
              fontSize: '14px',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Create an account
          </a>
        </div>
      </div>
    </div>
  );
}
