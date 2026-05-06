"use client"

import { supabase } from "@/lib/supabase"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function SignupForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else {
      alert("Check your email for confirmation")
      router.push('/login')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSignup} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-xs uppercase tracking-wider text-muted font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@springtech.co.ke"
          className="input w-full py-2.5"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-xs uppercase tracking-wider text-muted font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="input w-full py-2.5"
        />
      </div>

      <div className="pt-1">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </div>
    </form>
  )
}