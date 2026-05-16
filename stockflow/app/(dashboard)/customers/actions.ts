'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const customerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
})

export async function createCustomer(formData: FormData) {
  const raw = {
    name: formData.get('name'),
    phone: formData.get('phone') || null,
    email: formData.get('email') || null,
    address: formData.get('address') || null,
  }

  const parsed = customerSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const customer = await prisma.customer.create({
    data: parsed.data,
  })

  revalidatePath('/customers')
  redirect(`/customers/${customer.id}`)
}