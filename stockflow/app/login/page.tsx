"use client";

import { useActionState, useRef, useEffect } from "react";
import { signIn } from "@/actions/auth";

type AuthState = { error: string } | null;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(async (prevState: AuthState, formData: FormData) => {
    return await signIn(formData);
  }, null);

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus email input on mount
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-100" style={{ background: '#0e0f11' }}>
      <div className="w-full max-w-md p-8 rounded-lg border" style={{ background: '#161719', borderColor: '#2a2d32' }}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Syne', color: '#f0c040' }}>
            StockFlow
          </h1>
          <p className="text-sm mt-2" style={{ color: '#7a8090', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Manufacturing Platform
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-5">
          {/* Error Message */}
          {state?.error && (
            <div className="p-4 bg-red-900/20 border border-red-700/50 text-red-300 rounded-lg text-sm flex items-start gap-3 animate-pulse">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{state.error}</span>
            </div>
          )}

          {/* Email Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="email" className="text-xs uppercase tracking-wider font-medium" style={{ color: '#7a8090' }}>
              Email Address
            </label>
            <input
              ref={emailInputRef}
              type="email"
              id="email"
              name="email"
              required
              autoComplete="email"
              disabled={pending}
              className="w-full px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                background: '#1e2023',
                border: '1px solid #353a40',
                color: '#e8eaed',
                fontFamily: 'DM Sans',
                focusRingColor: '#f0c040',
                opacity: pending ? 0.6 : 1,
                cursor: pending ? 'not-allowed' : 'text',
              }}
              placeholder="you@company.com"
              aria-label="Email address"
              aria-required="true"
            />
          </div>

          {/* Password Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="password" className="text-xs uppercase tracking-wider font-medium" style={{ color: '#7a8090' }}>
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              disabled={pending}
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                background: '#1e2023',
                border: '1px solid #353a40',
                color: '#e8eaed',
                fontFamily: 'DM Sans',
                focusRingColor: '#f0c040',
                opacity: pending ? 0.6 : 1,
                cursor: pending ? 'not-allowed' : 'text',
              }}
              placeholder="••••••••"
              aria-label="Password"
              aria-required="true"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 px-4 font-semibold rounded-md transition-all duration-200 mt-8 flex items-center justify-center gap-2"
            style={{
              background: '#f0c040',
              color: '#000',
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.8 : 1,
              transform: pending ? 'scale(0.98)' : 'scale(1)',
            }}
            aria-busy={pending}
            aria-label={pending ? "Signing in..." : "Sign in"}
          >
            {pending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-8 border-t" style={{ borderColor: '#2a2d32' }}>
          <p className="text-xs text-center" style={{ color: '#7a8090' }}>
            Need help? Check the{' '}
            <a href="/README.md" className="font-medium hover:text-zinc-300 transition-colors" style={{ color: '#f0c040' }}>
              setup guide
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}