import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { InviteButton } from './_components/InviteButton'
import { UserTable } from './_components/ClientComponents'
import { withRetry } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

   const users = await withRetry(() => db.user.findMany({
     orderBy: { createdAt: 'asc' },
     include: {
       Branch: {
         select: {
           id: true,
           name: true,
         },
       },
     },
   }), undefined)

  const authUsers = await Promise.all(
    users.map(async (user) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(user.id)
      if (error) {
        console.error(`Failed to fetch auth user ${user.id}:`, error.message)
        return [user.id, null] as const
      }
      return [user.id, data.user] as const
    })
  )
  const authUsersById = new Map(authUsers)

  // Transform users for frontend compatibility
  const usersWithBranches = users.map(user => ({
    ...user,
    branches: user.Branch ? [user.Branch.name] : [],
    branchId: user.Branch?.id || '',
    isVerified: Boolean(authUsersById.get(user.id)?.email_confirmed_at),
  }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-head text-2xl font-bold">User management</h1>
          <p className="text-muted text-sm mt-1">
            Invite new users and manage roles and access
          </p>
        </div>
        <InviteButton />
      </div>

      <UserTable users={usersWithBranches} />
    </div>
  )
}
