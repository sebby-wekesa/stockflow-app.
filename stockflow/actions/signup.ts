'use server'

// Public user signup.
//
// This action runs before a user is authenticated. The user chooses an
// existing organization, then we create both the Supabase Auth user and the
// app User row under that organization. Admins can then verify and assign
// the final role from /users.

import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimitAsync, getClientIp } from '@/lib/rate-limit'
import { validatePassword } from '@/lib/security'
import { ALL_BRANCHES, normalizeBranchCode } from '@/lib/branches'

const signUpSchema = z.object({
  organizationId: z.string().trim().min(1, 'Select a valid organization'),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120),
  branchCode: z.enum(ALL_BRANCHES as [string, ...string[]], {
    errorMap: () => ({ message: 'Select a valid branch' }),
  }),
})

export async function signUpOrganization(formData: FormData) {
  // Rate-limit: 3 signups per hour per IP.
  const ip = await getClientIp()
  const rl = await checkRateLimitAsync(`signup:${ip}`, {
    windowMs: 60 * 60_000,
    maxRequests: 3,
  })
  if (!rl.success) {
    return { error: rl.error }
  }

  // Honeypot — claim success without doing anything so bots think they won
  if (formData.get('website')) {
    return { success: true }
  }

  // Parse + validate input
  let data: z.infer<typeof signUpSchema>
  try {
    data = signUpSchema.parse({
      organizationId: formData.get('organizationId'),
      email: formData.get('email'),
      password: formData.get('password'),
      fullName: formData.get('fullName'),
      branchCode: formData.get('branchCode'),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message ?? 'Invalid input' }
    }
    return { error: 'Invalid input' }
  }

  // Enforce password complexity
  const pw = validatePassword(data.password)
  if (!pw.isValid) {
    return { error: pw.errors[0] }
  }

  const organization = await prisma.organization.findFirst({
    where: {
      id: data.organizationId,
      status: { in: ['ACTIVE', 'PENDING_APPROVAL'] },
    },
    select: { id: true, name: true, status: true },
  })
  if (!organization) {
    return { error: 'Select a valid active organization.' }
  }

  // Branch rows can use business codes like MSA/NBO/BNJ while the signup UI
  // submits canonical app codes like mombasa/nairobi/bunje.
  const branches = await prisma.branch.findMany({
    where: { organizationId: data.organizationId },
    select: { id: true, code: true, name: true, location: true },
  })
  const branch = branches.find(
    (candidate) =>
      normalizeBranchCode(candidate.code, candidate.name, candidate.location) === data.branchCode
  )
  if (!branch) {
    return { error: 'Select a valid branch.' }
  }

  // Pre-check: does a User with this email already exist in our DB? If so,
  // bail out BEFORE we ask Supabase to create an auth user. This avoids the
  // race where we create an auth user, then fail the Prisma transaction, and
  // have to clean up.
  const existingUser = await prisma.user.findFirst({
    where: { email: data.email },
    select: { id: true },
  })
  if (existingUser) {
    return {
      error: 'An account with this email already exists. Try signing in instead.',
    }
  }

  // Create the Supabase auth user
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: false,
    user_metadata: {
      full_name: data.fullName,
      organization_id: organization.id,
      organization_name: organization.name,
      role: 'PENDING',
    },
  })

  if (authError || !authData.user) {
    // Supabase rejects duplicate emails with status 422
    const msg = authError?.message ?? 'Failed to create user'
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
      return { error: 'An account with this email already exists. Try signing in instead.' }
    }
    console.error('Supabase signup failed:', authError)
    return { error: 'Could not create your account. Please try again or contact support.' }
  }

  const authUserId = authData.user.id

  // Create the app User row. If this fails, delete the Supabase auth user so
  // the email can retry cleanly.
  try {
    await prisma.user.create({
      data: {
        id: authUserId,
        email: data.email,
        name: data.fullName,
        role: 'PENDING',
        organizationId: organization.id,
        branchId: branch.id,
      },
    })
  } catch (err) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
    } catch (cleanupErr) {
      console.error(
        '[signup] Failed to clean up orphan auth user',
        authUserId,
        cleanupErr
      )
    }

    const msg = (err as Error).message
    if (msg.includes('Unique') || msg.toLowerCase().includes('unique')) {
      return {
        error: 'A signup race occurred. Please try again with a different email.',
      }
    }
    console.error('[signup] User creation failed:', err)
    return {
      error: 'Could not create your account. Please try again or contact support.',
    }
  }

  return { success: true }
}
