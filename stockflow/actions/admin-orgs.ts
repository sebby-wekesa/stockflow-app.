'use server'

// Super-admin cross-organization actions.
//
// These intentionally operate across all tenants and therefore use the raw
// prisma client (not getTenantPrisma). Access is gated by requireSuperAdmin()
// which checks the SUPER_ADMIN_EMAILS env-var allowlist — NOT just user.role,
// which would let any tenant admin manage other tenants' orgs.
//
// To grant yourself super-admin: set SUPER_ADMIN_EMAILS in your env, e.g.
//   SUPER_ADMIN_EMAILS=you@fortunepath.co.ke,ops@fortunepath.co.ke

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/super-admin'

const reasonSchema = z
  .string()
  .trim()
  .min(3, 'Reason must be at least 3 characters')
  .max(500, 'Reason must be at most 500 characters')

const orgIdSchema = z.string().uuid('Invalid organization id')

export async function approveOrganization(orgId: string) {
  const admin = await requireSuperAdmin()
  const id = orgIdSchema.parse(orgId)

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) throw new Error('Organization not found')
  if (org.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot approve an organization with status ${org.status}`)
  }

  await prisma.organization.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      approvedAt: new Date(),
      disabledAt: null,
      disabledReason: null,
    },
  })

  console.log(`Super-admin ${admin.email} approved org ${org.name} (${id})`)
  revalidatePath('/admin/orgs')
}

export async function suspendOrganization(orgId: string, reason: string) {
  const admin = await requireSuperAdmin()
  const id = orgIdSchema.parse(orgId)
  const parsedReason = reasonSchema.parse(reason)

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) throw new Error('Organization not found')
  if (org.status === 'SUSPENDED') throw new Error('Already suspended')
  if (org.status === 'CLOSED') throw new Error('Organization is closed')

  await prisma.organization.update({
    where: { id },
    data: {
      status: 'SUSPENDED',
      disabledAt: new Date(),
      disabledReason: parsedReason,
    },
  })

  console.log(`Super-admin ${admin.email} suspended org ${org.name}: ${parsedReason}`)
  revalidatePath('/admin/orgs')
}

export async function reactivateOrganization(orgId: string) {
  const admin = await requireSuperAdmin()
  const id = orgIdSchema.parse(orgId)

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) throw new Error('Organization not found')
  if (org.status !== 'SUSPENDED') {
    throw new Error(`Cannot reactivate org with status ${org.status}`)
  }

  await prisma.organization.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      disabledAt: null,
      disabledReason: null,
    },
  })

  console.log(`Super-admin ${admin.email} reactivated org ${org.name}`)
  revalidatePath('/admin/orgs')
}

export async function rejectOrganization(orgId: string, reason: string) {
  const admin = await requireSuperAdmin()
  const id = orgIdSchema.parse(orgId)
  const parsedReason = reasonSchema.parse(reason)

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) throw new Error('Organization not found')
  if (org.status !== 'PENDING_APPROVAL') {
    throw new Error(`Can only reject pending organizations (this one is ${org.status})`)
  }

  await prisma.organization.update({
    where: { id },
    data: {
      status: 'CLOSED',
      disabledAt: new Date(),
      disabledReason: parsedReason,
    },
  })

  console.log(`Super-admin ${admin.email} rejected org ${org.name}: ${parsedReason}`)
  revalidatePath('/admin/orgs')
}
