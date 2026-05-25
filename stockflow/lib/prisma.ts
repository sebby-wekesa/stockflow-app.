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

  // Very conservative limit for Supabase session pooler
  if (!parsed.searchParams.has('connection_limit')) {
    parsed.searchParams.set('connection_limit', '5')
  }

  if (!parsed.searchParams.has('pool_timeout')) {
    parsed.searchParams.set('pool_timeout', '15')
  }

  if (!parsed.searchParams.has('statement_timeout')) {
    parsed.searchParams.set('statement_timeout', '10000')
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
 * Helper function to retry database operations on connection pool exhaustion
 * Implements exponential backoff with jitter to handle transient connection failures
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error

      // Check if this is a connection pool exhaustion or transient timeout error
      const isPoolError =
        error?.message?.includes?.('EMAXCONNSESSION') ||
        error?.message?.includes?.('max clients reached') ||
        error?.message?.includes?.('ETIMEDOUT') ||
        error?.message?.includes?.('timeout') ||
        error?.code === 'XX000' ||
        error?.code === 'ETIMEDOUT'

      // If not a pool error or this is the last attempt, throw
      if (!isPoolError || attempt === maxAttempts) {
        throw error
      }

      // Exponential backoff with jitter: delay = baseDelay * 2^(attempt-1) + random(0, baseDelay)
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)
      const jitter = Math.random() * baseDelayMs
      const delayMs = exponentialDelay + jitter

      console.warn(
        `Database connection pool exhausted (attempt ${attempt}/${maxAttempts}). ` +
        `Retrying in ${Math.round(delayMs)}ms...`
      )

      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
