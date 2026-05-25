'use server'

import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'

export async function updateLastSeen() {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    await db.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to update last seen:', error)
    return { success: false }
  }
}
