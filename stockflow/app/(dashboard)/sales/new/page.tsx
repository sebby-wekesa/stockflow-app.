import { redirect } from 'next/navigation'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { SalesForm } from '@/components/sales/SalesForm'
import { normalizeBranchCode, type BranchCode as Branch } from '@/lib/branches'

export const dynamic = 'force-dynamic';

export default async function NewSalesPage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  // For now, assume user has branch
  const [userWithBranches, organizationBranches] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, include: { Branch: true } }),
    db.branch.findMany({ orderBy: { name: 'asc' }, select: { code: true, name: true } }),
  ])

  if (!userWithBranches) redirect('/login')

  const databaseBranches = organizationBranches
    .map((branch) => normalizeBranchCode(branch.code, branch.name))
    .filter((branch): branch is Branch => branch !== null)

  const assignedBranch = normalizeBranchCode(userWithBranches.Branch?.code, userWithBranches.Branch?.name)
  const allowedBranches = (user.role === 'ADMIN' || user.role === 'MANAGER')
    ? Array.from(new Set(databaseBranches))
    : assignedBranch
      ? [assignedBranch]
      : []

  const defaultBranch = allowedBranches[0]

  // Guard: user has no branch assigned
  if (!defaultBranch) {
    return (
      <div className="sales-page">
        <div className="operator-empty">
          <div className="section-title">No branch assigned</div>
          <p className="section-sub">
          Your account is not linked to any branch. Please contact an administrator to assign you a branch before creating sales orders.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="sales-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">New Sales Order</div>
          <div className="section-sub">Create a draft or confirm an invoice from live product stock</div>
        </div>
        <span className="badge badge-teal">{allowedBranches.length} branch{allowedBranches.length === 1 ? '' : 'es'} available</span>
      </div>
      <SalesForm allowedBranches={allowedBranches} defaultBranch={defaultBranch} />
    </div>
  )
}
