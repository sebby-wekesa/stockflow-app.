"use server";

import { cookies } from "next/headers";
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
    return "No account found with this email address. Ask your organization administrator for an invitation.";
  }
  return "Authentication failed. Please try again.";
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Validate input early so we skip all I/O on bad data.
  const validation = loginSchema.safeParse({ email, password });
  if (!validation.success) {
    const errors = validation.error.flatten().fieldErrors;
    const firstError = errors.email?.[0] || errors.password?.[0] || "Invalid input";
    return { error: firstError };
  }

  // getClientIp() and createSupabaseClient() both only await Next.js header/
  // cookie stores — they are independent, so run them in parallel.
  const [ip, supabase] = await Promise.all([
    getClientIp(),
    createSupabaseClient(),
  ]);

  // Rate-limit: 5 attempts per minute per (IP, email). This stops single-source
  // brute force without locking out a busy office where many people sign in.
  const rlKey = `signin:${ip}:${validation.data.email.toLowerCase()}`;
  const rl = await checkRateLimitAsync(rlKey, { windowMs: 60_000, maxRequests: 5 });
  if (!rl.success) {
    return { error: rl.error };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: validation.data.email,
    password: validation.data.password,
  });

  if (error) {
    console.error("Supabase auth error:", error);
    return { error: getAuthErrorMessage(error) };
  }

  if (!data.user || !data.session) {
    return { error: "Authentication failed. Please try again." };
  }

  // NOTE: We do NOT call supabase.auth.getSession() here — data.session is
  // already the freshly-issued session returned by signInWithPassword.
  // A redundant getSession() would cost an extra ~300-800ms network round-trip
  // to Supabase on every login for zero benefit.

  // Verify the user has a fully-set-up account in our Prisma database.
  // Never auto-create a User row or attach a user to an organization.
  // Users arrive through the single-organization signup or an admin invite.
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
          "Your account isn't fully set up. Ask your organization administrator to invite you.",
      };
    }

    if (!existingUser.organizationId) {
      await supabase.auth.signOut();
      return {
        error:
          "Your account isn't linked to an organization. Please contact support.",
      };
    }

     // Sync DB role into Supabase token metadata if they diverge.
     // Fire-and-forget so the user is never blocked by a slow Admin API call —
     // the token will carry the correct role on the next login at the latest.
     if (existingUser.role && existingUser.role !== data.user.user_metadata?.role) {
       supabaseAdmin.auth.admin.updateUserById(data.user.id, {
         user_metadata: {
           name: existingUser.name,
           role: existingUser.role,
         },
       }).catch((err: unknown) => {
         console.error("[auth] background role sync failed:", err);
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
