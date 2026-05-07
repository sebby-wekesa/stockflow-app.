import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

let prisma: PrismaClient

if (isBuildTime) {
  // During build, use a mock prisma client to avoid database connections
  prisma = new Proxy({} as PrismaClient, {
    get: (target, prop) => {
      if (typeof prop === 'string') {
        return new Proxy({}, {
          get: (target, method) => {
            if (method === 'findMany' || method === 'findUnique' || method === 'findFirst') {
              return async () => []
            }
            if (method === 'count') {
              return async () => 0
            }
            if (method === 'create' || method === 'update' || method === 'delete') {
              return async () => ({})
            }
            return async () => {}
          }
        })
      }
      return target[prop]
    }
  })
} else {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL || "postgresql://dummy:dummy@localhost:5432/dummy"
  })

  prisma = globalForPrisma.prisma || new PrismaClient({ adapter })

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
}

export { prisma }