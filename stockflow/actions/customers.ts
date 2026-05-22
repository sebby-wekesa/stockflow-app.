'use server'

import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'

export async function searchCustomers(query: string) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  if (!query || query.length < 2) return []

  const customers = await db.customer.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
      ],
    },
    take: 10,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  })

  return customers
}
