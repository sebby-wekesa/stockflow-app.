import { prisma } from '@/lib/prisma'
import { InviteButton } from './_components/InviteButton'
import { UserTable } from './_components/ClientComponents'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      Branch: {
        select: {
          name: true,
        },
      },
    },
  })

  // Transform users for frontend compatibility
  const usersWithBranches = users.map(user => ({
    ...user,
    branches: user.Branch ? [user.Branch.name] : [],
    branchId: user.Branch?.id || '',
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