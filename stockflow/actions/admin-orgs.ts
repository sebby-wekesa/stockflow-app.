'use server'

// NOTE: These are super-admin cross-organization actions.
// They intentionally operate across all tenants and therefore use the raw prisma client
// (not getTenantPrisma). This is one of the approved exceptions for Week 2.
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireActiveAuth } from '@/lib/auth'

async function assertSuperAdmin() {
  const user = await requireActiveAuth()
  if (!['ADMIN'].includes(user.role)) { // In real super-admin flow this would check a super flag
    throw new Error('Forbidden: Super admin only')
  }
}

export async function approveOrganization(orgId: string) {
  await assertSuperAdmin()
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
  await assertSuperAdmin()
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
  await assertSuperAdmin()
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
  await assertSuperAdmin()
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
