import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

let adminInstance: ReturnType<typeof createClient> | null = null;

export const getSupabaseAdmin = () => {
  // Prevent initialization during build/static generation
  if (typeof window === 'undefined' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  if (adminInstance) return adminInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  try {
    adminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    return adminInstance;
  } catch (err) {
    console.error("Failed to create Supabase Admin client:", err);
    return null;
  }
};

// Export as a proxy to maintain backward compatibility
export const supabaseAdmin = new Proxy({} as any, {
  get(target, prop) {
    // Avoid triggering initialization for common inspection properties or symbols
    if (
      prop === 'toJSON' || 
      prop === 'constructor' || 
      prop === 'then' || 
      typeof prop === 'symbol' ||
      prop.toString().startsWith('$$typeof')
    ) {
      return undefined;
    }

    const client = getSupabaseAdmin();
    if (!client) {
      // Return a function/object that throws when used
      return new Proxy({} as any, {
        get() {
          throw new Error("Supabase Admin client failed to initialize. Please check your environment variables (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
        },
        apply() {
          throw new Error("Supabase Admin client failed to initialize. Please check your environment variables.");
        }
      });
    }
    return (client as any)[prop];
  }
});

// Server-side client for middleware - creates a client that can read cookies
export const supabaseServer = (request: NextRequest) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        // Middleware can't set cookies directly, but we can return a response with set cookies
        // This is handled by the middleware logic
      },
      remove(name: string, options: any) {
        // Middleware can't remove cookies directly
      },
    },
  });
};

// Server-side client for server components (non-middleware)
export const supabaseServerComponent = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set(name, value, options);
      },
      remove(name: string, options: any) {
        cookieStore.set(name, "", { ...options, maxAge: 0 });
      },
    },
  });
};