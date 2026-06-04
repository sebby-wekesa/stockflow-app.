'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'

const customerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.preprocess(
    (value) => value === '' ? null : value,
    z.string().trim().email().optional().nullable()
  ),
  address: z.string().trim().max(500).optional().nullable(),
  taxId: z.string().trim().max(100).optional().nullable(),
})

function readCustomerForm(formData: FormData) {
  return {
    name: formData.get('name'),
    contactName: formData.get('contactName') || null,
    phone: formData.get('phone') || null,
    email: formData.get('email') || null,
    address: formData.get('address') || null,
    taxId: formData.get('taxId') || null,
  }
}

export async function createCustomer(formData: FormData) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  const parsed = customerSchema.safeParse(readCustomerForm(formData))
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

export async function updateCustomer(customerId: string, formData: FormData) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  const parsed = customerSchema.safeParse(readCustomerForm(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const customer = await db.customer.findFirst({
    where: { id: customerId },
    select: { id: true },
  })
  if (!customer) {
    return { error: 'Customer not found' }
  }

  await db.customer.update({
    where: { id: customerId },
    data: parsed.data,
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  return { success: true }
}
