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

  // Enable connection pooling for Supabase (transaction mode recommended)
  if (!parsed.searchParams.has('pgbouncer')) {
    parsed.searchParams.set('pgbouncer', 'true')
  }

  // Supabase transaction pooler (pgbouncer) tuning — keep very low to avoid exhausting the pooler
  if (!parsed.searchParams.has('connection_limit')) {
    parsed.searchParams.set('connection_limit', '1')   // 1 is often safest with Next.js + pooler
  }

  if (!parsed.searchParams.has('pool_timeout')) {
    parsed.searchParams.set('pool_timeout', '10')
  }

  if (!parsed.searchParams.has('statement_timeout')) {
    parsed.searchParams.set('statement_timeout', '8000')
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

/**
 * Helper function to retry database operations on transient connection/pool errors.
 * Implements exponential backoff with jitter.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 6,   // increased for Supabase pooler flakiness in dev
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
