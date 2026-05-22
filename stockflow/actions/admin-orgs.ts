'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function approveOrganization(orgId: string) {
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
  })
  revalidatePath('/admin/orgs')
}

export async function suspendOrganization(orgId: string, reason: string) {
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'SUSPENDED',
      disabledAt: new Date(),
      disabledReason: reason,
    },
  })
  revalidatePath('/admin/orgs')
}

export async function reactivateOrganization(orgId: string) {
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'ACTIVE',
      disabledAt: null,
      disabledReason: null,
    },
  })
  revalidatePath('/admin/orgs')
}

export async function rejectOrganization(orgId: string) {
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'CLOSED',
      disabledAt: new Date(),
      disabledReason: 'Rejected by admin',
    },
  })
  revalidatePath('/admin/orgs')
}
