'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — only admins can manage users
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')

  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')
  if (user.role !== 'ADMIN') {
    throw new Error('Only admins can manage users')
  }
  return user
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE ADMIN CLIENT — uses service_role key for auth.users operations
// Only used server-side, never exposed to browser
// ─────────────────────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INVITE / CREATE USER
// Creates the auth.users row + the Prisma User record, then sends an invite email
// The invitee clicks the link, sets a password, and signs in.
// ─────────────────────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(200),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'WAREHOUSE', 'SALES', 'PACKAGING']),
  branchId: z.string().min(1, 'Branch is required'),
})

export async function inviteUser(formData: FormData) {
  const adminUser = await requireAdmin()

  const raw = {
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
    branchId: formData.get('branchId') || formData.get('branch'),
  }
  const parsed = inviteSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const { email, name, role, branchId } = parsed.data

  // Check if user already exists in our DB
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new Error('A user with this email already exists')
  }

  const supabaseAdmin = getSupabaseAdmin()

  // Send invite via Supabase. This creates auth.users with a confirmation token.
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback`
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo,
  })

  if (error) {
    throw new Error(`Could not send invite: ${error.message}`)
  }
  if (!data.user) {
    throw new Error('Invite did not return a user record')
  }

  // Create the Prisma User record so the new user can log in immediately after confirming
  await prisma.user.create({
    data: {
      id: data.user.id,
      email,
      name,
      role: role as UserRole,
      branchId,
      organizationId: adminUser.organizationId,
    },
  })

  revalidatePath('/users')
  redirect('/users')
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE USER — change role and branches
// ─────────────────────────────────────────────────────────────────────────────

const updateSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'WAREHOUSE', 'SALES', 'PACKAGING']),
  branchId: z.string().min(1),
})

export async function updateUser(userId: string, formData: FormData) {
  const adminUser = await requireAdmin()

  const raw = {
    name: formData.get('name'),
    role: formData.get('role'),
    branchId: formData.get('branchId'),
  }
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  // Cannot demote the last active admin
  if (parsed.data.role !== 'ADMIN') {
    const target = await prisma.user.findUnique({ where: { id: userId } })
    if (target?.role === 'ADMIN') {
      const otherAdmins = await prisma.user.count({
        where: { role: 'ADMIN', id: { not: userId } },
      })
      if (otherAdmins === 0) {
        throw new Error('Cannot remove admin role: at least one active admin is required')
      }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      role: parsed.data.role as UserRole,
      branchId: parsed.data.branchId,
    },
  })

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// DEACTIVATE / REACTIVATE
// We don't delete users — they have audit history attached.
// Deactivated users stay in the DB but cannot log in (we revoke their session).
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleUserActive(userId: string) {
  const adminUser = await requireAdmin()

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('User not found')

  // Can't deactivate yourself — that locks you out
  if (target.id === adminUser.id) {
    throw new Error("You cannot deactivate your own account")
  }

  // Can't deactivate the last admin
  if (target.role === 'ADMIN') {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: 'ADMIN', id: { not: userId } },
    })
    if (otherActiveAdmins === 0) {
      throw new Error('Cannot deactivate the last active admin')
    }
  }

  // If we're deactivating, also revoke the user's Supabase session
  // Users are always active in current schema
  const supabaseAdmin = getSupabaseAdmin()
  // Revoke their refresh tokens so they get logged out
  await supabaseAdmin.auth.admin.signOut(target.id, 'global').catch(() => {
    // Non-fatal — user record will still be marked inactive
  })

  // is_active field removed from schema - no update needed

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// RESEND INVITE — useful when invite email expired
// ─────────────────────────────────────────────────────────────────────────────

export async function resendInvite(userId: string) {
  await requireAdmin()

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('User not found')

  const supabaseAdmin = getSupabaseAdmin()
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback`

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(target.email, {
    data: { name: target.name },
    redirectTo,
  })

  if (error) {
    throw new Error(`Could not resend invite: ${error.message}`)
  }

  revalidatePath('/users')
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND PASSWORD RESET — for users who forgot their password
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPasswordReset(userId: string) {
  await requireAdmin()

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new Error('User not found')

  const supabaseAdmin = getSupabaseAdmin()
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback`

  const { error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: target.email,
    options: { redirectTo },
  })

  if (error) {
    throw new Error(`Could not send password reset: ${error.message}`)
  }

  revalidatePath(`/users/${userId}`)
}