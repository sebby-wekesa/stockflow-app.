'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'

const customerSchema = z.object({
  name: z.string().min(1).max(200),
  contactInfo: z.string().max(500).optional().nullable(),
})

async function requireUser() {
  const supabase = await createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')
  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'SALES') {
    throw new Error('Insufficient permissions')
  }
  return user
}

export async function createCustomer(formData: FormData) {
  await requireUser()
  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    contactInfo: formData.get('contactInfo') || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const customer = await prisma.customer.create({ data: parsed.data })
  revalidatePath('/customers')
  redirect(`/customers/${customer.id}`)
}

export async function updateCustomer(customerId: string, formData: FormData) {
  await requireUser()
  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    contactInfo: formData.get('contactInfo') || null,
  })
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  await prisma.customer.update({ where: { id: customerId }, data: parsed.data })
  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
}

export async function searchCustomers(query: string) {
  await requireUser()
  if (!query || query.length < 2) return []
  return prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { contactInfo: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 10,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, contactInfo: true },
  })
}
