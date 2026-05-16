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

  // Enable connection pooling for Supabase
  if (!parsed.searchParams.has('pgbouncer')) {
    parsed.searchParams.set('pgbouncer', 'true')
  }

  // Set reasonable connection limits to prevent pool exhaustion
  if (!parsed.searchParams.has('connection_limit')) {
    parsed.searchParams.set('connection_limit', '5')
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
    return createProxy() as PrismaClient;
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
      throw new Error(`Database connection failed: ${error.message}`)
    };
    const createProxy = () => new Proxy(throwFn, {
      get: (target, prop) => {
        if (prop === 'then') return undefined; // Prevent async handling
        return createProxy(); // Recursive proxy for nested properties
      }
    });
    return createProxy() as PrismaClient;
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
