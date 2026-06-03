import { redirect } from 'next/navigation'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { SalesForm } from '@/components/sales/SalesForm'
import type { BranchCode as Branch } from '@/lib/branches'

export const dynamic = 'force-dynamic';

export default async function NewSalesPage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  // For now, assume user has branch
  const userWithBranches = await db.user.findUnique({
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
      {/* PAGE HEADER */}
      <div className="section-header mb-8">
        <div>
          <div className="section-title">New sales order</div>
          <div className="section-sub">Create a new sales order and optionally invoice immediately</div>
        </div>
      </div>

      {/* SALES FORM */}
      <SalesForm allowedBranches={allowedBranches} defaultBranch={defaultBranch} />
    </div>
  )
}