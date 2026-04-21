"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { signIn } from "@/actions/auth";
import { Eye, EyeOff } from "lucide-react";

type AuthState = { error: string } | null;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(async (prevState: AuthState, formData: FormData) => {
    return await signIn(formData);
  }, null);

  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{email?: string, password?: string}>({});

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus email input on mount
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-100" style={{ background: '#0e0f11' }}>
      <div className="w-full max-w-md p-8 rounded-lg border bg-zinc-800 border-zinc-700">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-[Syne] text-yellow-400">
            StockFlow
          </h1>
          <p className="text-sm mt-2 text-zinc-400 uppercase tracking-widest">
            Manufacturing Platform
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-6">
          {/* Error Message */}
          {state?.error && (
            <div className="p-4 bg-red-900/20 border border-red-700/50 text-red-300 rounded-lg text-sm flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{state.error}</span>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs uppercase tracking-wider font-medium text-zinc-400 block">
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
              className="w-full px-4 py-3 rounded-md bg-zinc-700 border border-zinc-600 text-zinc-100 font-[DM_Sans] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="you@company.com"
              aria-label="Email address"
              aria-required="true"
              aria-invalid={!!formErrors.email}
              aria-describedby={formErrors.email ? "email-error" : undefined}
            />
            {formErrors.email && (
              <p id="email-error" className="text-xs text-red-400" role="alert">
                {formErrors.email}
              </p>
            )}
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-xs uppercase tracking-wider font-medium text-zinc-400 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                required
                disabled={pending}
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-12 rounded-md bg-zinc-700 border border-zinc-600 text-zinc-100 font-[DM_Sans] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="••••••••"
                aria-label="Password"
                aria-required="true"
                aria-invalid={!!formErrors.password}
                aria-describedby={formErrors.password ? "password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={pending}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {formErrors.password && (
              <p id="password-error" className="text-xs text-red-400" role="alert">
                {formErrors.password}
              </p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember"
              name="remember"
              className="w-4 h-4 bg-zinc-700 border-zinc-600 rounded focus:ring-yellow-400 focus:ring-2 text-yellow-400"
              disabled={pending}
            />
            <label htmlFor="remember" className="ml-2 text-sm text-zinc-400">
              Remember me for 7 days
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 px-4 font-semibold rounded-md bg-yellow-400 text-black transition-all duration-200 mt-8 flex items-center justify-center gap-2 hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-yellow-400 disabled:scale-100 active:scale-95"
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
        <div className="mt-8 pt-8 border-t border-zinc-700">
          <p className="text-xs text-center text-zinc-400">
            Need help? Check the{' '}
            <a href="/README.md" className="font-medium text-yellow-400 hover:text-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-zinc-800 rounded">
              setup guide
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}