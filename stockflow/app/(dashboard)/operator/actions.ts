'use server'

import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

export async function getOperatorData() {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)
    const data = await db.design.findMany()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: "Failed to fetch data" }
  }
}
