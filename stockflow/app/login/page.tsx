"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '@/actions/auth';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setMessage(null);
    try {
      const action = isLogin ? signIn : signUp;
      const res = await action(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res && "message" in res && res.message) {
        setMessage(res.message);
        setIsLogin(true);
        return;
      }
      if (res?.success) {
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
            StockFlow
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            letterSpacing: '1.5px',
            textTransform: 'uppercase'
          }}>
            Manufacturing Platform
          </div>
        </div>

        <form action={handleSubmit}>
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

          {message && (
            <div style={{
              background: 'rgba(46, 196, 160, 0.15)',
              color: 'var(--teal)',
              padding: '12px',
              borderRadius: 'var(--radius-small)',
              marginBottom: '16px',
              fontSize: '14px',
              border: '1px solid rgba(46, 196, 160, 0.3)'
            }}>
              {message}
            </div>
          )}

           {!isLogin && (
             <>
               <div className="form-group" style={{ marginBottom: '16px' }}>
                 <label className="form-label">Full Name</label>
                 <input
                   type="text"
                   name="name"
                   className="form-input"
                   placeholder="e.g. Jane Doe"
                   required
                 />
               </div>

               <div className="form-group" style={{ marginBottom: '16px' }}>
                 <label className="form-label">Branch</label>
                 <select
                   name="branch"
                   className="form-input"
                   required
                 >
                   <option value="">Select a branch</option>
                   <option value="mombasa">Mombasa HQ — Production + main store</option>
                   <option value="nairobi">Nairobi — Retail branch</option>
                   <option value="bonje">Bonje — Retail branch</option>
                 </select>
               </div>
             </>
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
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setMessage(null);
            }}
            className="btn btn-secondary"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px 16px',
              fontSize: '14px'
            }}
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
