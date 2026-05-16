import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20

// Use the design system badge classes
const PRODUCTION_STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: 'badge-amber',
  APPROVED: 'badge-blue',
  IN_PRODUCTION: 'badge-purple',
  COMPLETED: 'badge-teal',
  REJECTED: 'badge-red',
  CANCELLED: 'badge-red',
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const user = await getUser()
  if (!user) return null

  const params = await searchParams
  const status = params.status as 'PENDING' | 'APPROVED' | 'IN_PRODUCTION' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | undefined
  const page = Math.max(1, Number(params.page ?? 1))

  const where: any = {}
  if (status) where.status = status

  const [jobs, total] = await Promise.all([
    prisma.productionOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        design: { select: { name: true } },
        StageLog: {
          select: { completedAt: true, kgIn: true, kgOut: true, sequence: true }
        }
      }
    }),
    prisma.productionOrder.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Production Orders</div>
          <div className="section-sub">Manufacturing workflow and job tracking</div>
        </div>
        <Link href="/production/new" className="btn btn-primary">
          + New production order
        </Link>
      </div>

      {/* STATUS FILTERS */}
      <div className="flex flex-wrap gap-2 mb-16">
        <Link
          href="/jobs"
          className={`btn ${!status ? 'btn-primary' : 'btn-secondary'}`}
        >
          All Orders
        </Link>
        {(['PENDING', 'APPROVED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED'] as const).map((statusKey) => (
          <Link
            key={statusKey}
            href={`/jobs?status=${statusKey}`}
            className={`btn ${status === statusKey ? 'btn-primary' : 'btn-secondary'}`}
          >
            {statusKey.replace('_', ' ')}
          </Link>
        ))}
      </div>

      {/* JOBS LIST */}
      <div className="section-header mb-16">
        <div className="section-title">
          {status ? `${status.replace('_', ' ')} Orders` : 'All Production Orders'}
        </div>
        <div className="section-sub">{total} orders found</div>
      </div>

      <div className="space-y-4">
        {jobs.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-muted">
              <p className="mb-4">No production orders found.</p>
              <p className="text-sm">Production orders will appear here once created.</p>
            </div>
          </div>
        ) : (
          jobs.map((job) => {
            const completedStages = job.StageLog.filter(s => s.completedAt).length
            const totalStages = job.StageLog.length
            const currentStage = job.StageLog.find(s => !s.completedAt)

            return (
              <div
                key={job.id}
                className="card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-medium text-lg">Order {job.orderNumber}</h3>
                      <span className={`badge ${PRODUCTION_STATUS_BADGE_CLASS[job.status] || 'badge-muted'}`}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-muted mb-4">
                      {job.design?.name || 'Unknown Design'}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted">Quantity</div>
                        <div className="font-medium">{job.quantity} units</div>
                      </div>
                      <div>
                        <div className="text-muted">Target</div>
                        <div className="font-medium font-mono">{job.targetKg}kg</div>
                      </div>
                      <div>
                        <div className="text-muted">Progress</div>
                        <div className="font-medium">{completedStages}/{totalStages} stages</div>
                      </div>
                      {currentStage && (
                        <div>
                          <div className="text-muted">Current Stage</div>
                          <div className="font-medium">Stage {currentStage.sequence}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right ml-6">
                    <div className="text-muted text-sm">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </div>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="btn btn-secondary btn-sm mt-2"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-16 gap-2">
          {page > 1 && (
            <Link
              href={`/jobs?${new URLSearchParams({ ...(status && { status }), page: String(page - 1) })}`}
              className="btn btn-secondary"
            >
              Previous
            </Link>
          )}

          <div className="px-4 py-2 bg-surface-secondary border border-border rounded-md text-muted text-sm">
            Page {page} of {totalPages}
          </div>

          {page < totalPages && (
            <Link
              href={`/jobs?${new URLSearchParams({ ...(status && { status }), page: String(page + 1) })}`}
              className="btn btn-secondary"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
