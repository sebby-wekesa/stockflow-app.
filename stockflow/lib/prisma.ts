import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL

function getPoolMax() {
  const configured = Number(process.env.DB_POOL_MAX || process.env.DB_CONNECTION_LIMIT)
  if (Number.isFinite(configured) && configured > 0) {
    return configured
  }

  // The pg adapter owns a node-postgres pool per server process. Keep the
  // default small so multiple warm Next.js workers do not exhaust low
  // session-mode pooler caps such as Supabase's 15-client limit.
  return process.env.NODE_ENV === 'production' ? 2 : 1
}

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

    // Production defaults for pooler tuning. Allow overriding via env var
    const defaultConnLimit = process.env.DB_CONNECTION_LIMIT || String(getPoolMax())
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', defaultConnLimit)
    }

    const defaultPoolTimeout = process.env.DB_POOL_TIMEOUT || (process.env.NODE_ENV === 'production' ? '30' : '10')
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', defaultPoolTimeout)
    }

    const defaultStatementTimeout = process.env.DB_STATEMENT_TIMEOUT || '8000'
    if (!parsed.searchParams.has('statement_timeout')) {
      parsed.searchParams.set('statement_timeout', defaultStatementTimeout)
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
    const pool = new Pool({
      connectionString: getConnectionString(databaseUrl),
      max: getPoolMax(),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10_000),
      connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10_000),
    })
    const adapter = new PrismaPg(pool, { disposeExternalPool: true })
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

// 5. Auth lookups use the same adapter-backed singleton. Keeping this
// export preserves existing imports without creating a second connection
// path.
export const authPrisma = prisma

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
         try {
           const { logDbError } = await import('./prisma-metrics')
           logDbError(error)
         } catch {
           console.error('withRetry: giving up', {
             attempt,
             maxAttempts,
             name: error?.name,
             code: error?.code,
             prismaCode: (error as any)?.code,
             message: error?.message?.slice(0, 300),
           })
         }
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
