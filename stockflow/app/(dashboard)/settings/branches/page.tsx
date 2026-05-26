import { redirect } from 'next/navigation'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { BranchesClient } from './_components/BranchesClient'

export const dynamic = 'force-dynamic'

export default async function BranchesPage() {
  const user = await requireActiveAuth()

  // Only admins and managers can view/manage branches
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    redirect('/dashboard')
  }

  const db = getTenantPrisma(user.organizationId)

  // Fetch branches + per-branch counts so admins know what's there before
  // they try to delete anything
  const branches = (await db.branch.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      location: true,
      address: true,
      phone: true,
      createdAt: true,
      _count: {
        select: {
          User: true,
          Product: true,
          StockMovement: true,
        },
      },
    },
  })) as unknown as Array<{
    id: string
    name: string
    code: string
    location: string | null
    address: string | null
    phone: string | null
    createdAt: Date
    _count: { User: number; Product: number; StockMovement: number }
  }>

  return (
    <>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Branches</div>
          <div className="section-sub">
            Physical locations for {user.organization.name} — warehouses, retail outlets, production sites.
          </div>
        </div>
      </div>

      <BranchesClient
        canDelete={user.role === 'ADMIN'}
        branches={branches.map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          location: b.location ?? null,
          address: b.address ?? null,
          phone: b.phone ?? null,
          createdAt: b.createdAt.toISOString(),
          userCount: b._count.User,
          productCount: b._count.Product,
          movementCount: b._count.StockMovement,
        }))}
      />
    </>
  )
}
