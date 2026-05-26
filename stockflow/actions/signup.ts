'use server'

// SPECIAL CASE: Organization signup / bootstrap.
//
// This action runs before any user is authenticated to a tenant. It creates
// the very first Organization + User for a new company. It intentionally uses
// the raw prisma client because no organizationId yet exists.
//
// Hardening (Phase 3):
//   1. Slug + code collisions are handled by appending -2, -3, etc. up to
//      a small ceiling, then falling back to a random suffix. This prevents
//      the second "Acme Springs" signup from crashing on a unique constraint.
//   2. Password complexity is enforced via lib/security.validatePassword.
//   3. We pre-check whether the email already exists in our User table so
//      we fail BEFORE creating a Supabase auth user (which avoids orphaning
//      a Supabase user when the Prisma transaction would have failed).

import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimitAsync, getClientIp } from '@/lib/rate-limit'
import { validatePassword } from '@/lib/security'

const signUpSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120),
})

function baseSlug(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || 'organization'
}

function baseCode(name: string): string {
  const c = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
  return c || 'NEWORG'
}

/** Returns { slug, code } guaranteed to be unique across Organization, or throws after exhausting retries. */
async function generateUniqueOrgIdentifiers(name: string): Promise<{ slug: string; code: string }> {
  const slug0 = baseSlug(name)
  const code0 = baseCode(name)

  // Try the bare name first
  const bare = await prisma.organization.findFirst({
    where: { OR: [{ slug: slug0 }, { code: code0 }] },
    select: { id: true },
  })
  if (!bare) return { slug: slug0, code: code0 }

  // Try -2, -3, ... -50 with a numeric suffix
  for (let n = 2; n <= 50; n++) {
    const slug = `${slug0}-${n}`.slice(0, 60)
    const code = `${code0}${n}`.slice(0, 10)
    const collision = await prisma.organization.findFirst({
      where: { OR: [{ slug }, { code }] },
      select: { id: true },
    })
    if (!collision) return { slug, code }
  }

  // Last-resort: a short random suffix
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Math.random().toString(36).slice(2, 7)
    const slug = `${slug0}-${rand}`.slice(0, 60)
    const code = `${code0.slice(0, 5)}${rand.toUpperCase()}`.slice(0, 10)
    const collision = await prisma.organization.findFirst({
      where: { OR: [{ slug }, { code }] },
      select: { id: true },
    })
    if (!collision) return { slug, code }
  }

  throw new Error('Could not allocate a unique organization identifier. Please try a different company name.')
}

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
      companyName: formData.get('companyName'),
      email: formData.get('email'),
      password: formData.get('password'),
      fullName: formData.get('fullName'),
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

  // Pre-check: does a User with this email already exist in our DB? If so,
  // bail out BEFORE we ask Supabase to create an auth user. This avoids the
  // race where we create an auth user, then fail the Prisma transaction, and
  // have to clean up.
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  })
  if (existingUser) {
    return {
      error: 'An account with this email already exists. Try signing in instead.',
    }
  }

  // Allocate org identifiers BEFORE creating the auth user, so a collision
  // surfaces as a clean error message without leaving an auth user orphan.
  let slug: string
  let code: string
  try {
    ({ slug, code } = await generateUniqueOrgIdentifiers(data.companyName))
  } catch (err) {
    return { error: (err as Error).message }
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
    user_metadata: { full_name: data.fullName },
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

  // Create Organization + User atomically. If this fails, delete the
  // Supabase auth user so the email can retry.
  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.companyName,
          code,
          slug,
          status: 'PENDING_APPROVAL',
          ownerUserId: authUserId,
        },
      })

      await tx.user.create({
        data: {
          id: authUserId,
          email: data.email,
          name: data.fullName,
          role: 'ADMIN',
          organizationId: org.id,
        },
      })
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
        error: 'A signup race occurred. Please try again with a different company name.',
      }
    }
    console.error('[signup] Org+User creation failed:', err)
    return {
      error: 'Could not create your organization. Please try again or contact support.',
    }
  }

  return { success: true }
}
