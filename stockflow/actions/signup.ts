'use server'

// SPECIAL CASE: Organization signup / bootstrap
// This action runs before any user is authenticated to a tenant.
// It creates the very first Organization + User for a new company.
// It intentionally uses the raw prisma client because no organizationId yet exists.
// This is one of the approved Week 2 exceptions.
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const signUpSchema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
})

export async function signUpOrganization(formData: FormData) {
  // Rate-limit: 3 signups per hour per IP. Generous enough for a legitimate
  // user who fat-fingers their company name twice, strict enough to slow
  // scripted spam to a crawl. Honeypot-tripped requests do NOT count toward
  // the limit (we want bots to think they're succeeding).
  const ip = await getClientIp();
  const rl = checkRateLimit(`signup:${ip}`, {
    windowMs: 60 * 60_000, // 1 hour
    maxRequests: 3,
  });
  if (!rl.success) {
    return { error: rl.error };
  }

  const data = signUpSchema.parse({
    companyName: formData.get('companyName'),
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
  })

  if (formData.get('website')) {
    return { success: true }
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: false,
    user_metadata: { full_name: data.fullName },
  })

  if (error || !authUser.user) {
    throw new Error(error?.message || 'Failed to create user')
  }

  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.companyName,
          code: data.companyName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'NEWORG',
          slug: data.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          status: 'PENDING_APPROVAL',
          ownerUserId: authUser.user.id,
        },
      })

      await tx.user.create({
        data: {
          id: authUser.user.id,
          email: data.email,
          name: data.fullName,
          role: 'ADMIN',
          organizationId: org.id,
        },
      })
    })
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
    throw err
  }

  return { success: true }
}
