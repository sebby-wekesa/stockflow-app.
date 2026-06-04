"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clearAuthCookies } from "@/lib/auth-session";
import { validatePassword } from "@/lib/security";

export async function setInvitedUserPassword(formData: FormData) {
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");

  if (typeof password !== "string" || typeof confirmation !== "string") {
    return { error: "Password and confirmation are required." };
  }

  if (password !== confirmation) {
    return { error: "Passwords do not match." };
  }

  const validation = validatePassword(password);
  if (!validation.isValid) {
    return { error: validation.errors[0] };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: "Your invitation session has expired. Ask an administrator to send a new invite.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: `Could not set password: ${error.message}` };
  }

  await supabase.auth.signOut();
  clearAuthCookies(cookieStore);

  return { success: true };
}
