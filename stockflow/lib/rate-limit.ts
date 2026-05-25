// lib/rate-limit.ts
//
// In-memory rate limiter.
//
// LIMITATION: in serverless deployments (Vercel, Lambda) each instance has
// its own Map, so an attacker hitting parallel cold instances bypasses the
// limit. This is acceptable as a first line of defence but you should swap
// to a Redis-backed limiter (Upstash, Redis Cloud) before going public with
// signup. See Phase 5 in the audit plan.

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: Request) => string;
}

/**
 * Lower-level check used by both the request-based middleware and the
 * Server-Action friendly checkRateLimit() below.
 */
function checkAndIncrement(
  key: string,
  windowMs: number,
  maxRequests: number
): { success: true } | { success: false; error: string; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true };
  }

  if (entry.count >= maxRequests) {
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      error: `Too many attempts. Try again in ${resetIn} seconds.`,
      resetIn,
    };
  }

  entry.count++;
  rateLimitStore.set(key, entry);
  return { success: true };
}

/**
 * Existing request-based middleware factory. Kept as-is for the existing
 * API-route caller (app/api/production-orders/route.ts).
 */
export function rateLimit(options: RateLimitOptions) {
  return async function rateLimitMiddleware(request: Request) {
    const keyGenerator =
      options.keyGenerator ||
      ((req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
        return `${req.method}:${req.url}:${ip}`;
      });

    return checkAndIncrement(
      keyGenerator(request),
      options.windowMs,
      options.maxRequests
    );
  };
}

/**
 * Server Action-friendly rate limiter. Takes a string key directly because
 * Server Actions don't have access to a Request object.
 *
 * Usage:
 *   import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
 *
 *   const ip = await getClientIp()
 *   const rl = checkRateLimit(`login:${ip}`, { windowMs: 60_000, maxRequests: 5 })
 *   if (!rl.success) return { error: rl.error }
 */
export function checkRateLimit(
  key: string,
  options: { windowMs: number; maxRequests: number }
) {
  return checkAndIncrement(key, options.windowMs, options.maxRequests);
}

/**
 * Read the client IP from Next.js request headers. Returns 'unknown' if
 * we can't determine it. Safe to call from Server Actions and Server
 * Components.
 *
 * Important: rate-limiting by 'unknown' shares the bucket across all
 * unidentified clients, which is intentional — it means a misconfigured
 * proxy still gets *some* protection rather than none.
 */
export async function getClientIp(): Promise<string> {
  // Dynamic import so this file can be imported from environments that
  // don't expose next/headers (e.g. tests).
  const { headers } = await import('next/headers');
  const h = await headers();

  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const real = h.get('x-real-ip');
  if (real) return real.trim();

  return 'unknown';
}

// Clean up expired entries periodically. Only runs in long-lived Node
// processes; serverless instances are recycled before this matters.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60_000);
}
