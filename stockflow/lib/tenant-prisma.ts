import { PrismaClient, Prisma } from '@prisma/client'

/**
 * Tenant-scoped Prisma client factory.
 * Automatically injects organizationId into queries for tenant isolation.
 */
const tenantClientCache = new Map<string, ReturnType<typeof createTenantClient>>()

function createTenantClient(organizationId: string) {
  const prisma = new PrismaClient()

  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
          }
          return query(args)
        },

        async findFirst({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
          }
          return query(args)
        },

        async findFirstOrThrow({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
          }
          return query(args)
        },

        async count({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
          }
          return query(args)
        },

        async aggregate({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
          }
          return query(args)
        },

        async groupBy({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
          }
          return query(args)
        },

        async findUnique({ model, args, query }) {
          const result = await query(args)
          if (result && hasOrganizationId(model) && (result as any).organizationId !== organizationId) {
            return null
          }
          return result
        },

        async findUniqueOrThrow({ model, args, query }) {
          const result = await query(args)
          if (result && hasOrganizationId(model) && (result as any).organizationId !== organizationId) {
            throw new Error(`Record not found or belongs to different organization`)
          }
          return result
        },

        async create({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.data = { ...args.data, organizationId }
          }
          return query(args)
        },

        async createMany({ model, args, query }) {
          if (hasOrganizationId(model) && Array.isArray(args.data)) {
            args.data = args.data.map((item: any) => ({ ...item, organizationId }))
          }
          return query(args)
        },

        async update({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
          }
          return query(args)
        },

        async updateMany({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
          }
          return query(args)
        },

        async delete({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
          }
          return query(args)
        },

        async deleteMany({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
          }
          return query(args)
        },

        async upsert({ model, args, query }) {
          if (hasOrganizationId(model)) {
            args.where = { ...args.where, organizationId }
            args.create = { ...args.create, organizationId }
            args.update = { ...args.update }
          }
          return query(args)
        },
      },
    },
  })
}

function hasOrganizationId(model: string): boolean {
  const modelsWithOrg = [
    'Product', 'SaleOrder', 'SaleItem', 'StockMovement',
    'User', 'Branch', 'ImportBatch', 'ImportRow', 'RawMaterial',
    'MaterialReceipt', 'ProductionOrder', 'FinishedGoods'
  ]
  return modelsWithOrg.includes(model)
}

export function getTenantPrisma(organizationId: string) {
  if (!tenantClientCache.has(organizationId)) {
    tenantClientCache.set(organizationId, createTenantClient(organizationId))
  }
  return tenantClientCache.get(organizationId)!
}

/**
 * Transaction helper that scopes all operations inside the callback.
 */
export async function withTenantTransaction<T>(
  organizationId: string,
  fn: (tx: any) => Promise<T>
): Promise<T> {
  const db = getTenantPrisma(organizationId)
  return db.$transaction(async (tx) => {
    return fn(tx)
  })
}
