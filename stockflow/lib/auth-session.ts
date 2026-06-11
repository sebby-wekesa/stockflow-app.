import { createClient, type Session } from "@supabase/supabase-js";
import { authPrisma, withRetry } from "./prisma";
import { normalizeUserRole, ROLE_PATHS, type UserRole } from "./types";

type MutableCookieStore = {
  set(name: string, value: string, options?: Record<string, unknown>): unknown;
};

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function setUserRoleCookie(cookieStore: MutableCookieStore, role: UserRole) {
  cookieStore.set("user-role", role, getCookieOptions(SESSION_MAX_AGE));
}

export function setAuthCookies(cookieStore: MutableCookieStore, session: Session, role: UserRole) {
  cookieStore.set("auth-token", session.access_token, getCookieOptions(SESSION_MAX_AGE));
  cookieStore.set("refresh-token", session.refresh_token, getCookieOptions(REFRESH_MAX_AGE));
  setUserRoleCookie(cookieStore, role);
}

export function clearAuthCookies(cookieStore: MutableCookieStore) {
  const expiredCookie = { expires: new Date(0), path: "/" };

  // Clear old auth cookies
  cookieStore.set("auth-token", "", expiredCookie);
  cookieStore.set("refresh-token", "", expiredCookie);

  // Clear Supabase session cookie
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const projectRef = supabaseUrl.split('.')[0].split('//')[1];
    cookieStore.set(`sb-${projectRef}-auth-token`, "", expiredCookie);
  }

  cookieStore.set("user-role", "", expiredCookie);
  cookieStore.set("demo-logged-in", "", expiredCookie);
}

export async function resolveUserRole(userId: string, fallbackRole: unknown): Promise<UserRole> {
  try {
    const user = await withRetry(() =>
      authPrisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
      2,
    );

    return normalizeUserRole(user?.role ?? fallbackRole);
  } catch (error) {
    console.error("User role lookup failed:", error);
    return normalizeUserRole(fallbackRole);
  }
}

export function getRoleHomePage(role: unknown) {
  return ROLE_PATHS[normalizeUserRole(role)] ?? "/dashboard";
}

export async function getSessionContext(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    if (error) {
      console.error("Session lookup failed:", error.message);
    }
    return null;
  }

  return {
    user,
    role: await resolveUserRole(user.id, user.user_metadata?.role),
  };
}
