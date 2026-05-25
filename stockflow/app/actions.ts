'use server'

// Legacy barrel export — prefer direct imports from specific action files.
// Kept for backward compatibility during the tenant migration.
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

export async function getStock() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  return await db.design.findMany({ where: { organizationId: user.organizationId } })
}
