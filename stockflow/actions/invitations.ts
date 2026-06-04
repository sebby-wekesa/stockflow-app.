"use server";

import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveUserRole, setAuthCookies } from "@/lib/auth-session";

export async function acceptInvitation(_previousState: unknown, formData: FormData) {
  const tokenHash = formData.get("token_hash");
  const type = formData.get("type");

  if (typeof tokenHash !== "string" || !tokenHash) {
    return { error: "This invitation link is missing its verification token." };
  }

  if (type !== "invite") {
    return { error: "This is not a valid invitation link." };
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

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error || !data.session || !data.user) {
    console.error("Invitation verification failed:", error);
    return {
      error:
        "This invitation has expired or is no longer valid. Ask your administrator to resend it.",
    };
  }

  const role = await resolveUserRole(data.user.id, data.user.user_metadata?.role);
  setAuthCookies(cookieStore, data.session, role);
  redirect("/set-password");
}
