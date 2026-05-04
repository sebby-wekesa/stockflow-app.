import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function requireAuth(request: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return { error: 'Unauthorized', status: 401 }
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, role: true, full_name: true, org_id: true, branch_id: true }
  })

  if (!user) {
    return { error: 'User not found', status: 404 }
  }

  return { user }
}

export async function requireRole(request: NextRequest, allowedRoles: string[]) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth

  if (!allowedRoles.includes(auth.user.role)) {
    return { error: 'Insufficient permissions', status: 403 }
  }

  return { user: auth.user }
}