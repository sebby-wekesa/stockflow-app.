'use server'

import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')
  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')
  return user
}

export async function searchCustomers(query: string) {
  await requireUser()
  if (!query || query.length < 2) return []

  const customers = await prisma.customer.findMany({
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