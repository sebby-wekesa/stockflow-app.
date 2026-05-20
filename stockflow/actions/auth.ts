"use server";

import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clearAuthCookies } from "@/lib/auth-session";
import { prisma, withRetry } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { ALL_BRANCHES } from "@/lib/branches";

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
  const { data: { session: verifySession } } = await supabase.auth.getSession();
  if (!verifySession) {
    console.error("Session not established properly");
    return { error: "Authentication failed. Please try again." };
  }

  // Ensure user exists in database (public.User table)
  try {
    const existingUser = await withRetry(() =>
      prisma.user.findUnique({ where: { id: data.user.id } })
    );

    if (!existingUser) {
      await withRetry(() =>
        prisma.user.create({
          data: {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.name || '',
            role: (data.user.user_metadata?.role as any) || 'PENDING',
            password: 'SUPABASE_AUTH',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      );
      console.log("Created new user record in database");
    } else {
      if (existingUser.role && existingUser.role !== data.user.user_metadata?.role) {
        await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
          user_metadata: { 
            name: existingUser.name,
            role: existingUser.role
          }
        });
        console.log("Updated user metadata with current role from database");
      }
      console.log("User record already exists in database");
    }

    // Ensure user has an organization (create default if missing)
    const userWithOrg = await prisma.user.findUnique({
      where: { id: data.user.id },
      include: { Organization: true }
    });
    if (!userWithOrg?.Organization) {
      let org = await prisma.organization.findFirst();
      if (!org) {
        org = await prisma.organization.create({
          data: { name: "Default Org", code: "DEFAULT" }
        });
      }
      await prisma.user.update({
        where: { id: data.user.id },
        data: { organizationId: org.id }
      });
      console.log("Linked user to organization:", org.id);
    }
  } catch (dbError) {
    console.error("Database user creation failed:", dbError);
  }

  console.log("Login successful, session and database records established");
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
