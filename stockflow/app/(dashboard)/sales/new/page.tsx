import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SalesForm } from '@/components/sales/SalesForm'
import type { BranchCode as Branch } from '@/lib/branches'

export const dynamic = 'force-dynamic';

export default async function NewSalesPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  // For now, assume user has branch
  const userWithBranches = await prisma.user.findUnique({
    where: { id: user.id },
    include: { Branch: true }
  })

  if (!userWithBranches) redirect('/login')

  const allowedBranches = (user.role === 'ADMIN' || user.role === 'MANAGER')
    ? (['mombasa', 'nairobi', 'bonje'] as Branch[])
    : (userWithBranches.Branch?.code ? [userWithBranches.Branch.code as Branch] : [])

  const defaultBranch = allowedBranches[0]

  // Guard: user has no branch assigned
  if (!defaultBranch) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">No branch assigned</h1>
        <p className="text-muted">
          Your account is not linked to any branch. Please contact an administrator to assign you a branch before creating sales orders.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-head text-2xl font-bold">New sales order</h1>
        <p className="text-muted text-sm mt-1">
          Create a new sales order and optionally invoice immediately
        </p>
      </div>

      <SalesForm allowedBranches={allowedBranches} defaultBranch={defaultBranch} />
    </div>
  )
}