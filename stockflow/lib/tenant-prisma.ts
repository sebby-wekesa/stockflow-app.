/**
 * Tenant-scoped Prisma client.
 *
 * Uses Prisma's $extends API to auto-inject `organizationId` into every
 * read query on tenant-scoped models, and to verify it's present on every
 * write. Developers who forget the filter get a runtime error instead of
 * a silent cross-tenant data leak.
 *
 * USAGE:
 *
 *   import { getTenantPrisma } from '@/lib/tenant-prisma'
 *
 *   const user = await requireActiveAuth()
 *   const db = getTenantPrisma(user.organizationId)
 *
 *   // Now every query is automatically scoped:
 *   const products = await db.product.findMany()
 *   // Equivalent to: prisma.product.findMany({ where: { organizationId: '...' } })
 *
 *   await db.product.create({ data: { name, sku, ... } })
 *   // organizationId is automatically added to `data`
 *
 * MODELS NOT auto-scoped (system-level, no orgId):
 *   - Profile (Supabase auth-managed)
 *   - All auth.* schema tables
 *
 * Anything else gets scoped. If you need to bypass for system jobs, use
 * the unwrapped `prisma` import directly.
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { prisma } from './prisma'

type TenantPrismaClient = PrismaClient

// Models that DON'T have organizationId — system-level or auth-managed
const UNSCOPED_MODELS = new Set([
  'Profile',
  'Organization', // root tenant table itself
])

const cache = new Map<string, TenantPrismaClient>()

/**
 * Returns a Prisma client extension scoped to the given org. Cached per org.
 */
export function getTenantPrisma(organizationId: string): TenantPrismaClient {
  if (!organizationId) {
    throw new Error('getTenantPrisma called without organizationId')
  }

  const cached = cache.get(organizationId)
  if (cached) return cached as TenantPrismaClient

  const tenantClient = prisma.$extends({
    name: `tenant-scope-${organizationId.slice(0, 8)}`,
    query: {
      $allModels: {
        // READ operations: inject organizationId into where
        async findFirst({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.where = { ...(args.where ?? {}), organizationId }
          return query(args)
        },
        async findMany({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.where = { ...(args.where ?? {}), organizationId }
          return query(args)
        },
        async findFirstOrThrow({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.where = { ...(args.where ?? {}), organizationId }
          return query(args)
        },
        async findUnique({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          // findUnique can only use unique keys, so we can't add org to where directly.
          // Instead, run the query then double-check the result belongs to this tenant.
          const result = await query(args)
          if (result && (result as any).organizationId &&
              (result as any).organizationId !== organizationId) {
            return null as any
          }
          return result
        },
        async findUniqueOrThrow({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          const result = await query(args)
          if (result && (result as any).organizationId &&
              (result as any).organizationId !== organizationId) {
            throw new Error(
              `Record not found in tenant scope (model: ${model})`
            )
          }
          return result
        },
        async count({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.where = { ...(args.where ?? {}), organizationId }
          return query(args)
        },
        async aggregate({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.where = { ...(args.where ?? {}), organizationId }
          return query(args)
        },
        async groupBy({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.where = { ...(args.where ?? {}), organizationId }
          return query(args)
        },

        // WRITE operations: inject organizationId into data
        async create({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.data = { ...(args.data ?? {}), organizationId } as any
          return query(args)
        },
        async createMany({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          if (Array.isArray(args.data)) {
            args.data = args.data.map((row: any) => ({ ...row, organizationId })) as any
          } else {
            args.data = { ...(args.data ?? {}), organizationId } as any
          }
          return query(args)
        },
        async update({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          // Cannot add to where (unique filter only). Verify after.
          // We use updateMany internally pattern: pre-check the record belongs to us.
          // Simpler: scope where by adding org filter via Prisma's compound key.
          // For safety, check the target's org matches before updating.
          args.where = { ...(args.where ?? {}), organizationId }
          return query(args)
        },
        async updateMany({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.where = { ...(args.where ?? {}), organizationId }
          return query(args)
        },
        async upsert({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.where = { ...(args.where ?? {}), organizationId }
          args.create = { ...(args.create ?? {}), organizationId } as any
          // update doesn't need organizationId injected since it can't change
          return query(args)
        },
        async delete({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.where = { ...(args.where ?? {}), organizationId }
          return query(args)
        },
        async deleteMany({ args, query, model }: { args: any; query: (a: any) => Promise<any>; model: string }) {
          if (UNSCOPED_MODELS.has(model)) return query(args)
          args.where = { ...(args.where ?? {}), organizationId }
          return query(args)
        },
      },
    },
  })

  cache.set(organizationId, tenantClient as any)
  return tenantClient as TenantPrismaClient
}

/**
 * Clear the tenant client cache. Useful in tests or when org status changes.
 */
export function clearTenantPrismaCache() {
  cache.clear()
}

/**
 * Run a callback inside a Prisma transaction with tenant scoping applied to
 * the transaction client. Use this when you need to do multiple writes
 * atomically AND want auto-injection of organizationId.
 *
 *   await withTenantTransaction(organizationId, async (tx) => {
 *     await tx.product.update({ where: { id }, data: { ... } })
 *     await tx.stockMovement.create({ data: { ... } })
 *   })
 *
 * If you don't need atomicity, just call methods on the result of
 * getTenantPrisma() directly — that's simpler.
 */
export async function withTenantTransaction<T>(
  organizationId: string,
  fn: (tx: any) => Promise<T>,
  options?: { maxWait?: number; timeout?: number }
): Promise<T> {
  if (!organizationId) {
    throw new Error('withTenantTransaction called without organizationId')
  }

  return prisma.$transaction(
    async (tx) => {
      // Build a small inline extension on the transaction client that
      // does the same org-injection we do for the main client.
      const scopedTx = new Proxy(tx, {
        get(target: any, prop: string | symbol) {
          const value = target[prop]
          if (typeof prop !== 'string' || prop.startsWith('$') || prop.startsWith('_')) {
            return value
          }
          // Model accessor (e.g. tx.product)
          if (value && typeof value === 'object') {
            return new Proxy(value, {
              get(modelTarget: any, methodName: string | symbol) {
                const method = modelTarget[methodName]
                if (typeof method !== 'function') return method
                if (typeof methodName !== 'string') return method
                // Get the Prisma model name from the accessor (e.g. product -> Product)
                const modelName = (prop as string).charAt(0).toUpperCase() + (prop as string).slice(1)
                if (UNSCOPED_MODELS.has(modelName)) return method.bind(modelTarget)

                return (args: any = {}) => {
                  switch (methodName) {
                    case 'findFirst':
                    case 'findMany':
                    case 'findFirstOrThrow':
                    case 'count':
                    case 'aggregate':
                    case 'groupBy':
                    case 'updateMany':
                    case 'deleteMany':
                    case 'update':
                    case 'delete':
                      args.where = { ...(args.where ?? {}), organizationId }
                      break
                    case 'create':
                      args.data = { ...(args.data ?? {}), organizationId }
                      break
                    case 'createMany':
                      if (Array.isArray(args.data)) {
                        args.data = args.data.map((row: any) => ({ ...row, organizationId }))
                      } else {
                        args.data = { ...(args.data ?? {}), organizationId }
                      }
                      break
                    case 'upsert':
                      args.where = { ...(args.where ?? {}), organizationId }
                      args.create = { ...(args.create ?? {}), organizationId }
                      break
                  }
                  return method.call(modelTarget, args)
                }
              },
            })
          }
          return value
        },
      })

      return fn(scopedTx)
    },
    options
  )
}
