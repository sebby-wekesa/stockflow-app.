// lib/rate-limit.ts
// Simple in-memory rate limiter for development
// In production, use Redis or a proper rate limiting service

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: Request) => string; // Function to generate rate limit key
}

export function rateLimit(options: RateLimitOptions) {
  return async function rateLimitMiddleware(request: Request) {
    const keyGenerator = options.keyGenerator || ((req) => {
      // Default: rate limit by IP address
      const forwarded = req.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
      return `${req.method}:${req.url}:${ip}`;
    });

    const key = keyGenerator(request);
    const now = Date.now();
    const windowMs = options.windowMs;
    const maxRequests = options.maxRequests;

    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return { success: true };
    }

    if (entry.count >= maxRequests) {
      // Rate limit exceeded
      const resetIn = Math.ceil((entry.resetTime - now) / 1000);
      return {
        success: false,
        error: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
        resetIn,
      };
    }

    // Increment counter
    entry.count++;
    rateLimitStore.set(key, entry);

    return { success: true };
  };
}

// Clean up expired entries periodically (simple implementation)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute