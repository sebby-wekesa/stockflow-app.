import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const databaseUrl = process.env.DATABASE_URL

function getConnectionString(url: string) {
  const parsed = new URL(url)

  // Prisma 7's pg adapter uses node-postgres semantics. Preserve the
  // expected libpq behavior for existing `sslmode=require` URLs.
  if (parsed.searchParams.get('sslmode') === 'require' && !parsed.searchParams.has('uselibpqcompat')) {
    parsed.searchParams.set('uselibpqcompat', 'true')
  }

  // Only inject Supabase / pgbouncer tuning in production by default.
  // In local development multiple hot-reloaded Prisma instances can cause
  // transient ETIMEDOUT errors when forced through a pooler. If you need
  // to test pooler behavior locally, set ENABLE_PG_BOUNCER=true.
  const enablePgbouncer = process.env.ENABLE_PG_BOUNCER === 'true' || process.env.NODE_ENV === 'production'

  if (enablePgbouncer) {
    if (!parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true')
    }

    // Supabase transaction pooler (pgbouncer) tuning — keep conservative defaults
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '1')   // 1 is often safest with serverless poolers
    }

    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '10')
    }

    if (!parsed.searchParams.has('statement_timeout')) {
      parsed.searchParams.set('statement_timeout', '8000')
    }
  }

  return parsed.toString()
}

// 1. Define the singleton function
const prismaClientSingleton = () => {
  if (!databaseUrl) {
    console.error('DATABASE_URL is not configured')
    // Return a mock client that throws on usage
    const throwFn = () => {
      throw new Error('DATABASE_URL is not configured')
    };
    const createProxy = () => new Proxy(throwFn, {
      get: (target, prop) => {
        if (prop === 'then') return undefined; // Prevent async handling
        return createProxy(); // Recursive proxy for nested properties
      }
    });
    return createProxy() as unknown as PrismaClient;
  }

  try {
    console.log('Initializing Prisma client with adapter...')
    const adapter = new PrismaPg({ connectionString: getConnectionString(databaseUrl) })
    const client = new PrismaClient({ adapter })
    console.log('Prisma client initialized successfully')
    return client
  } catch (error) {
    console.error('Failed to create Prisma client:', error)
    // Return a mock client that throws on usage
    const throwFn = () => {
      const msg = error instanceof Error ? error.message : String(error)
      throw new Error(`Database connection failed: ${msg}`)
    };
    const createProxy = () => new Proxy(throwFn, {
      get: (target, prop) => {
        if (prop === 'then') return undefined; // Prevent async handling
        return createProxy(); // Recursive proxy for nested properties
      }
    });
    return createProxy() as unknown as PrismaClient;
  }
}

// 2. Setup the global type for development hot-reloading
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined
}

  // 3. Export the instance
  export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

  // 4. Prevent multiple instances in development
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

  // If running under Turbopack/Next dev with many hot-reloads, increase
  // the retry window slightly to tolerate transient pooler flakiness.
  // Allow opt-in override via DEV_DB_RETRY_ATTEMPTS.
  export const DEFAULT_DB_MAX_RETRY = Number(process.env.DEV_DB_RETRY_ATTEMPTS || 6)

  // 5. Export authPrisma and helpers unchanged

/**
 * Lightweight Prisma client for authentication lookups only.
 * Uses DIRECT_URL (bypasses Supabase pooler) for much higher reliability
 * on the hot path that runs on every page load.
 */
const directUrl = process.env.DIRECT_URL

function getDirectConnectionString(url: string) {
  if (!url) return url;

  const parsed = new URL(url);

  // Inject uselibpqcompat for sslmode=require to keep current behavior
  // (suppresses the deprecation warning from pg/pg-connection-string)
  if (parsed.searchParams.get('sslmode') === 'require' && !parsed.searchParams.has('uselibpqcompat')) {
    parsed.searchParams.set('uselibpqcompat', 'true');
  }

  return parsed.toString();
}

const authClientSingleton = () => {
  if (!directUrl) {
    console.warn('DIRECT_URL not set — falling back to main prisma for auth')
    return prisma
  }

  try {
    const processedUrl = getDirectConnectionString(directUrl);
    const adapter = new PrismaPg({ connectionString: processedUrl });
    const client = new PrismaClient({ adapter });
    return client;
  } catch (error) {
    console.error('Failed to create auth Prisma client with DIRECT_URL, falling back')
    return prisma
  }
}

type AuthClient = ReturnType<typeof authClientSingleton>

const globalForAuthPrisma = globalThis as unknown as {
  authPrisma: AuthClient | undefined
}

export const authPrisma = globalForAuthPrisma.authPrisma ?? authClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalForAuthPrisma.authPrisma = authPrisma
}

/**
 * Helper function to retry database operations on transient connection/pool errors.
 * Implements exponential backoff with jitter.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = Number(process.env.DB_MAX_RETRY_ATTEMPTS || process.env.DEV_DB_RETRY_ATTEMPTS || 6),
  baseDelayMs: number = 200
): Promise<T> {
  let lastError: any

  const isRetryableError = (error: any): boolean => {
    const msg = (error?.message || '').toLowerCase()
    const code = error?.code || ''
    const prismaCode = (error as any)?.code || ''

    // Connection / pool / timeout errors (very common with Supabase pooler)
    if (
      code === 'ETIMEDOUT' ||
      code === 'XX000' ||
      msg.includes('etimedout') ||
      msg.includes('timeout') ||
      msg.includes('emaxconnsession') ||
      msg.includes('max clients reached') ||
      msg.includes('connection') ||
      msg.includes('pool') ||
      msg.includes('too many connections')
    ) {
      return true
    }

    // Prisma known request errors that are usually transient
    if (error?.name === 'PrismaClientKnownRequestError') {
      if (['P1001', 'P1002', 'P1008', 'P1017'].includes(prismaCode)) {
        return true // connection refused / timeout / closed / etc.
      }
    }

    return false
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error

      if (!isRetryableError(error) || attempt === maxAttempts) {
        // Log full details on final failure (or non-retryable error)
        console.error('withRetry: giving up', {
          attempt,
          maxAttempts,
          name: error?.name,
          code: error?.code,
          prismaCode: (error as any)?.code,
          message: error?.message?.slice(0, 300),
        })
        throw error
      }

      // Exponential backoff with jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)
      const jitter = Math.random() * baseDelayMs
      const delayMs = exponentialDelay + jitter

      console.warn(
        `withRetry: transient DB error (attempt ${attempt}/${maxAttempts}). ` +
        `Retrying in ${Math.round(delayMs)}ms...`,
        {
          name: error?.name,
          code: error?.code,
          prismaCode: (error as any)?.code,
        }
      )

      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
