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

  const allowedBranches = user.role === 'admin'
    ? (['mombasa', 'nairobi', 'bonje'] as Branch[])
    : (userWithBranches.Branch ? [userWithBranches.Branch.id as Branch] : [])

  const defaultBranch = allowedBranches[0]

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