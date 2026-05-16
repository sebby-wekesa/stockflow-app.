import { createClient } from "@supabase/supabase-js";

let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const getSupabase = () => {
  // Prevent initialization during build/static generation
  if (typeof window === 'undefined' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return null;
  }

  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
  } catch (err) {
    console.error("Failed to create Supabase client:", err);
    return null;
  }
};

// Export as a proxy to maintain backward compatibility with existing imports
export const supabase = new Proxy({} as any, {
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

    const client = getSupabase();
    if (!client) {
      // Return a function/object that throws when used
      return new Proxy({} as any, {
        get() {
          throw new Error("Supabase client failed to initialize. Please check your environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/ANON_KEY).");
        },
        apply() {
          throw new Error("Supabase client failed to initialize. Please check your environment variables.");
        }
      });
    }
    return (client as any)[prop];
  }
});