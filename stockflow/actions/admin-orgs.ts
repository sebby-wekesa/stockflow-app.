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
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  sendOrgApprovedEmail,
  sendOrgRejectedEmail,
  sendOrgSuspendedEmail,
  sendOrgReactivatedEmail,
} from '@/lib/emails/org-status'

const reasonSchema = z
  .string()
  .trim()
  .min(3, 'Reason must be at least 3 characters')
  .max(500, 'Reason must be at most 500 characters')

const orgIdSchema = z.string().uuid('Invalid organization id')

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

/**
 * Look up the org owner's email + display name, used as the recipient for
 * status-change notifications. Returns null if no owner is found (which
 * shouldn't happen — signup always sets ownerUserId — but we fail gracefully).
 */
async function getOrgOwner(orgId: string): Promise<{ email: string; name: string | null } | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerUserId: true },
  })
  if (!org?.ownerUserId) return null

  const owner = (await prisma.user.findUnique({
    where: { id: org.ownerUserId },
    select: { email: true, name: true },
  })) as { email: string; name: string | null } | null
  return owner ?? null
}

/**
 * Send a notification email without blocking the action on success/failure.
 * Email failures are logged but don't throw — the org status change has
 * already committed by the time we reach this code.
 */
async function notify(
  action: string,
  orgId: string,
  send: () => Promise<{ ok: boolean; error?: string }>
): Promise<void> {
  try {
    const result = await send()
    if (!result.ok) {
      console.error(`[admin-orgs] ${action} email failed for org ${orgId}:`, result.error)
    }
  } catch (err) {
    console.error(`[admin-orgs] ${action} email threw for org ${orgId}:`, err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE
// ─────────────────────────────────────────────────────────────────────────────

export async function approveOrganization(orgId: string) {
  const admin = await requireSuperAdmin()
  const id = orgIdSchema.parse(orgId)

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) throw new Error('Organization not found')
  if (org.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot approve an organization with status ${org.status}`)
  }

  if (org.ownerUserId) {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not configured')
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(org.ownerUserId, {
      email_confirm: true,
    })

    if (error) {
      throw new Error(`Owner verification failed: ${error.message}`)
    }
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

  // Fire-and-forget the approval email. We don't await its result blocking
  // the action — but we DO await its completion so the serverless function
  // doesn't get killed before the email leaves.
  const owner = await getOrgOwner(id)
  if (owner) {
    await notify('approve', id, () =>
      sendOrgApprovedEmail({
        ownerEmail: owner.email,
        ownerName: owner.name,
        organizationName: org.name,
        appUrl: getAppUrl(),
      })
    )
  } else {
    console.warn(`[admin-orgs] No owner found for org ${id}, skipping approval email`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUSPEND
// ─────────────────────────────────────────────────────────────────────────────

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

  const owner = await getOrgOwner(id)
  if (owner) {
    await notify('suspend', id, () =>
      sendOrgSuspendedEmail({
        ownerEmail: owner.email,
        ownerName: owner.name,
        organizationName: org.name,
        appUrl: getAppUrl(),
        reason: parsedReason,
      })
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REACTIVATE
// ─────────────────────────────────────────────────────────────────────────────

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

  const owner = await getOrgOwner(id)
  if (owner) {
    await notify('reactivate', id, () =>
      sendOrgReactivatedEmail({
        ownerEmail: owner.email,
        ownerName: owner.name,
        organizationName: org.name,
        appUrl: getAppUrl(),
      })
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REJECT
// ─────────────────────────────────────────────────────────────────────────────

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

  const owner = await getOrgOwner(id)
  if (owner) {
    await notify('reject', id, () =>
      sendOrgRejectedEmail({
        ownerEmail: owner.email,
        ownerName: owner.name,
        organizationName: org.name,
        appUrl: getAppUrl(),
        reason: parsedReason,
      })
    )
  }
}
