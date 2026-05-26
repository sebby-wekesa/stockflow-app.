"use server";

import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clearAuthCookies } from "@/lib/auth-session";
// NOTE: This file contains both normal authenticated paths and critical bootstrap logic
// (first-login user creation, default org creation). Bootstrap sections intentionally
// use the base prisma client because no organizationId exists yet.
// This is documented as an approved Week 2 exception.
import { prisma, withRetry } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { checkRateLimitAsync, getClientIp } from "@/lib/rate-limit";

const ROLE_PATHS = {
  ADMIN: "/admin/dashboard",
  MANAGER: "/dashboard",
  WAREHOUSE: "/dashboard",
  SALES: "/dashboard",
  ACCOUNTANT: "/reports",
  OPERATOR: "/dashboard",
  PACKAGING: "/dashboard",
  PENDING: "/dashboard/setup",
};

async function createSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // We can ignore this in Server Actions.
          }
        },
      },
    }
  );
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function getAuthErrorMessage(error: unknown) {
  const message = readErrorMessage(error);

  if (message.includes('Invalid login credentials')) {
    return "Invalid email or password. Please check your credentials and try again.";
  }
  if (message.includes('Email not confirmed')) {
    return "Please check your email and click the confirmation link before signing in.";
  }
  if (message.includes('User not found') || message.includes('user_not_found')) {
    return "No account found with this email address. Please sign up first.";
  }
  return "Authentication failed. Please try again.";
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Rate-limit: 5 attempts per minute per (IP, email). This stops single-source
  // brute force without locking out a busy office where many people sign in.
  // Check happens BEFORE input validation so even malformed requests count.
  const ip = await getClientIp();
  const rlKey = `signin:${ip}:${(email ?? '').toLowerCase().trim()}`;
  const rl = await checkRateLimitAsync(rlKey, { windowMs: 60_000, maxRequests: 5 });
  if (!rl.success) {
    return { error: rl.error };
  }

  // Validate input
  const validation = loginSchema.safeParse({ email, password });

  if (!validation.success) {
    const errors = validation.error.flatten().fieldErrors;
    const firstError = errors.email?.[0] || errors.password?.[0] || "Invalid input";
    return { error: firstError };
  }

  // Create Supabase server client
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: validation.data.email,
    password: validation.data.password,
  });

  if (error) {
    console.error("Supabase auth error:", error);
    return { error: getAuthErrorMessage(error) };
  }

  if (!data.user) {
    return { error: "Authentication failed. Please try again." };
  }

  if (!data.session) {
    return { error: "Authentication failed. Please try again." };
  }

  // Verify session is properly set in cookies
  try {
    const { data: { session: verifySession } } = await supabase.auth.getSession();
    if (!verifySession) {
      // Log a diagnostic snapshot of cookie names (no token values) to help debug missing refresh token issues.
      try {
        const cookieStoreDiag = (await cookies()).getAll().map(c => ({ name: c.name, hasValue: !!c.value, len: c.value?.length ?? 0 }));
        console.error('Session not established properly. Cookie snapshot (names+lengths):', cookieStoreDiag);
      } catch (cErr) {
        console.error('Session not established and failed to read cookies for diagnostics', String(cErr));
      }

      return { error: "Authentication failed. Session not established (missing auth cookies). Ensure cookies are enabled and you are on HTTPS." };
    }
  } catch (getSessionErr) {
    // If Supabase throws a known auth error (eg. refresh_token_not_found), surface a helpful message and log details.
    console.error('supabase.auth.getSession error during sign-in:', String(getSessionErr));
    // Avoid leaking tokens; include code/status if available for diagnostics.
    const isAuthErr = (getSessionErr as any)?.__isAuthError;
    const code = (getSessionErr as any)?.code || (getSessionErr as any)?.status || 'unknown';
    if (isAuthErr) {
      // If refresh token missing, clear any stale cookies to avoid stuck sessions.
      try {
        const cookieStore = await cookies();
        const names = cookieStore.getAll().map(c => c.name);
        console.warn('Clearing stale auth cookies due to auth error:', names);
        // Clear typical auth cookie names
        cookieStore.set('auth-token', '', { expires: new Date(0), path: '/' });
        cookieStore.set('refresh-token', '', { expires: new Date(0), path: '/' });
      } catch (cErr) {
        console.error('Failed to clear cookies after auth error:', String(cErr));
      }

      return { error: `Authentication failed (auth error: ${code}). Verify that your Supabase keys and cookie configuration are correct.` };
    }

    return { error: 'Authentication failed. Please try again later.' };
  }

  // Verify the user has a fully-set-up account in our Prisma database.
  // In multitenant mode, never auto-create a User row or attach a user to
  // the first available organization. Users must arrive via signup or invite.
  try {
    const existingUser = await withRetry(() =>
      prisma.user.findUnique({
        where: { id: data.user.id },
        select: { id: true, role: true, name: true, organizationId: true },
      })
    );

    if (!existingUser) {
      await supabase.auth.signOut();
      return {
        error:
          "Your account isn't fully set up. Please complete signup or ask your administrator to invite you.",
      };
    }

    if (!existingUser.organizationId) {
      await supabase.auth.signOut();
      return {
        error:
          "Your account isn't linked to an organization. Please contact support.",
      };
    }

    if (existingUser.role && existingUser.role !== data.user.user_metadata?.role) {
      await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        user_metadata: {
          name: existingUser.name,
          role: existingUser.role,
        },
      });
    }
  } catch (dbError) {
    console.error("Sign-in verification failed:", dbError);
    await supabase.auth.signOut();
    return {
      error: "Unable to verify your account. Please try again or contact support.",
    };
  }

  console.log("Login successful, session and database records verified");
  return { success: true };
}

export async function signOut() {
  try {
    const supabase = await createSupabaseClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Supabase signout error:", error);
  }

  // Clear all cookies
  const cookieStore = await cookies();
  clearAuthCookies(cookieStore);

  redirect("/login");
}

export async function signUp(formData: FormData) {
  // Stage 2+: Old signup flow is disabled.
  // New multitenant signup will be implemented in Stage 4.
  return {
    error: "Signup is currently disabled. Please contact an administrator or use the new signup flow (coming soon)."
  };
}
