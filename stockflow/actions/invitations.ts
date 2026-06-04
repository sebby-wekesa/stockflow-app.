"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveUserRole, setAuthCookies } from "@/lib/auth-session";

export async function acceptInvitation(formData: FormData) {
  const emailValue = formData.get("email");
  const tokenValue = formData.get("token");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const token = typeof tokenValue === "string" ? tokenValue.replace(/\D/g, "") : "";

  if (!email) {
    return { error: "Enter the email address that received the invitation." };
  }

  if (!/^\d{6,10}$/.test(token)) {
    return { error: "Enter the numeric invitation code exactly as shown in the email." };
  }

  try {
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
      email,
      token,
      type: "invite",
    });

    if (error || !data.session || !data.user) {
      console.error("Invitation verification failed:", error);
      return {
        error: error?.message
          ? `Could not accept invitation: ${error.message}`
          : "This invitation is no longer valid. Ask your administrator to resend it.",
      };
    }

    const role = await resolveUserRole(data.user.id, data.user.user_metadata?.role);
    setAuthCookies(cookieStore, data.session, role);
  } catch (error) {
    console.error("Invitation acceptance failed:", error);
    return {
      error: error instanceof Error ? error.message : "Could not accept invitation.",
    };
  }

  redirect("/set-password");
}
