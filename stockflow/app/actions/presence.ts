'use server'

import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'

export async function updateLastSeen() {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    // Use the main prisma client for this lightweight write to reduce extension overhead
    await db.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    })

    return { success: true }
  } catch (error) {
    // Swallow errors — presence is non-critical
    if (process.env.NODE_ENV === 'development') {
      console.debug('updateLastSeen skipped (expected in dev):', (error as Error).message)
    }
    return { success: false }
  }
}
