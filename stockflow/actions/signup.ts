'use server'

// Public user signup for the single organization configured in the database.
//
// New accounts remain pending until an administrator assigns their final role.

import { createClient } from '@supabase/supabase-js'
import { prisma, withRetry } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimitAsync, getClientIp } from '@/lib/rate-limit'
import { validatePassword } from '@/lib/security'
import { getSystemOrganization } from '@/lib/system-organization'

const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120),
  branchId: z.string().trim().min(1, 'Select a valid branch'),
})

export async function signUpUser(formData: FormData) {
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
      email: formData.get('email'),
      password: formData.get('password'),
      fullName: formData.get('fullName'),
      branchId: formData.get('branchId'),
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

  let organization
  try {
    organization = await getSystemOrganization()
  } catch (error) {
    console.error('[signup] Single organization configuration error:', error)
    return { error: 'Account registration is temporarily unavailable. Please contact support.' }
  }

  const branch = await withRetry(() =>
    prisma.branch.findFirst({
      where: {
        id: data.branchId,
        organizationId: organization.id,
      },
      select: { id: true },
    })
  )
  if (!branch) {
    return { error: 'Select a valid branch.' }
  }

  const existingUser = await withRetry(() =>
    prisma.user.findFirst({
      where: { email: data.email },
      select: { id: true },
    })
  )
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

  try {
    await withRetry(() =>
      prisma.user.create({
        data: {
          id: authUserId,
          email: data.email,
          name: data.fullName,
          role: 'PENDING',
          organizationId: organization.id,
          branchId: branch.id,
        },
      })
    )
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

// Keep the old export name for callers that have not moved to signUpUser yet.
export const signUpOrganization = signUpUser
