// lib/rate-limit.ts
//
// Rate limiter with two backends:
//   1. Upstash Redis, selected when UPSTASH_REDIS_REST_URL and token are set
//   2. In-memory Map for local development and fallback

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

type RateLimitResult =
  | { success: true }
  | { success: false; error: string; resetIn: number };

function checkAndIncrementInMemory(
  key: string,
  windowMs: number,
  maxRequests: number
): RateLimitResult {
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

function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function checkAndIncrementUpstash(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const windowSec = Math.ceil(windowMs / 1000);
  const redisKey = `rl:${key}`;

  let pipelineResult: Array<{ result?: number | string; error?: string }>;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(windowSec), "NX"],
        ["PTTL", redisKey],
      ]),
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      throw new Error(`Upstash returned HTTP ${res.status}`);
    }

    pipelineResult = await res.json();

    // Validate pipeline shape — Upstash returns an array of arrays per command
    if (!Array.isArray(pipelineResult) || pipelineResult.length < 3) {
      console.error('[rate-limit] Unexpected Upstash pipeline response:', pipelineResult);
      return { success: true };
    }
  } catch (err) {
    console.error(
      "[rate-limit] Upstash unreachable, allowing request:",
      err instanceof Error ? err.message : err
    );
    return { success: true };
  }

  const count = Number(pipelineResult[0]?.result ?? 0);
  const pttlMs = Number(pipelineResult[2]?.result ?? windowMs);

  if (count > maxRequests) {
    const resetIn = Math.max(1, Math.ceil(pttlMs / 1000));
    return {
      success: false,
      error: `Too many attempts. Try again in ${resetIn} seconds.`,
      resetIn,
    };
  }

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

    return checkRateLimitAsync(keyGenerator(request), {
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
    });
  };
}

/**
 * Synchronous in-memory rate limiter kept for backwards compatibility.
 * Prefer checkRateLimitAsync for new call sites so production can use Upstash.
 */
export function checkRateLimit(
  key: string,
  options: { windowMs: number; maxRequests: number }
) {
  return checkAndIncrementInMemory(key, options.windowMs, options.maxRequests);
}

export async function checkRateLimitAsync(
  key: string,
  options: { windowMs: number; maxRequests: number }
): Promise<RateLimitResult> {
  if (isUpstashConfigured()) {
    return checkAndIncrementUpstash(key, options.windowMs, options.maxRequests);
  }

  return checkAndIncrementInMemory(key, options.windowMs, options.maxRequests);
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
