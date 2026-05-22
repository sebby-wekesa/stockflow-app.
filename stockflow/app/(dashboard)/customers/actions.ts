'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'

const customerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
})

export async function createCustomer(formData: FormData) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  const raw = {
    name: formData.get('name'),
    phone: formData.get('phone') || null,
    email: formData.get('email') || null,
    address: formData.get('address') || null,
  }

  const parsed = customerSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  // Generate a unique code per org (simple slug + short random)
  const base = parsed.data.name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'CUST'
  const code = `${base}-${Date.now().toString(36).slice(-5).toUpperCase()}`

  const customer = await db.customer.create({
    data: {
      ...parsed.data,
      code,
      organizationId: user.organizationId,
    },
  })

  revalidatePath('/customers')
  redirect(`/customers/${customer.id}`)
}