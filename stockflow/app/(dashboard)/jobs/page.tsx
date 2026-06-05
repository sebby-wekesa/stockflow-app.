import Link from 'next/link'
import type { Prisma, ProductionStatus } from '@prisma/client'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { withRetry } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const STATUS_OPTIONS: ProductionStatus[] = [
  'PENDING',
  'APPROVED',
  'IN_PRODUCTION',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
]

const PRODUCTION_STATUS_BADGE_CLASS: Record<ProductionStatus, string> = {
  PENDING: 'badge-amber',
  APPROVED: 'badge-blue',
  IN_PRODUCTION: 'badge-purple',
  COMPLETED: 'badge-teal',
  REJECTED: 'badge-red',
  CANCELLED: 'badge-red',
}

const PRIORITY_BADGE_CLASS: Record<string, string> = {
  LOW: 'badge-muted',
  MEDIUM: 'badge-blue',
  HIGH: 'badge-amber',
  URGENT: 'badge-red',
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  const params = await searchParams
  const status = STATUS_OPTIONS.includes(params.status as ProductionStatus)
    ? params.status as ProductionStatus
    : undefined
  const page = Math.max(1, Number(params.page ?? 1))
  const where: Prisma.ProductionOrderWhereInput = status ? { status } : {}

  const [jobs, total, statusCounts] = await Promise.all([
    withRetry(() => db.productionOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        design: {
          select: {
            name: true,
            _count: { select: { stages: true } },
          },
        },
        StageLog: {
          select: { completedAt: true },
        },
      },
    }), undefined),
    withRetry(() => db.productionOrder.count({ where }), undefined),
    withRetry(() => db.productionOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
    }), undefined),
  ])

  const countByStatus = new Map(statusCounts.map((item) => [item.status, item._count._all]))
  const allOrders = statusCounts.reduce((sum, item) => sum + item._count._all, 0)
  const activeOrders = (countByStatus.get('APPROVED') ?? 0) + (countByStatus.get('IN_PRODUCTION') ?? 0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildHref(nextStatus?: ProductionStatus, nextPage = 1) {
    const query = new URLSearchParams()
    if (nextStatus) query.set('status', nextStatus)
    if (nextPage > 1) query.set('page', String(nextPage))
    const value = query.toString()
    return value ? `/jobs?${value}` : '/jobs'
  }

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

      <div className="stats-grid mb-16">
        <div className="stat-card amber">
          <div className="stat-label">Total orders</div>
          <div className="stat-value">{allOrders.toLocaleString()}</div>
          <div className="stat-sub">All production orders</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Active jobs</div>
          <div className="stat-value">{activeOrders.toLocaleString()}</div>
          <div className="stat-sub">Approved or in production</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Pending approval</div>
          <div className="stat-value">{(countByStatus.get('PENDING') ?? 0).toLocaleString()}</div>
          <div className="stat-sub">Waiting to start</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{(countByStatus.get('COMPLETED') ?? 0).toLocaleString()}</div>
          <div className="stat-sub">Finished production orders</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Filter by Status</div>
            <div className="section-sub">Choose a production workflow state</div>
          </div>
          <span className="badge badge-muted">{total} results</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/jobs" className={`btn ${!status ? 'btn-primary' : 'btn-ghost'}`}>
            All orders ({allOrders})
          </Link>
          {STATUS_OPTIONS.map((statusKey) => (
            <Link
              key={statusKey}
              href={buildHref(statusKey)}
              className={`btn ${status === statusKey ? 'btn-primary' : 'btn-ghost'}`}
            >
              {statusKey.replaceAll('_', ' ')} ({countByStatus.get(statusKey) ?? 0})
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">
              {status ? `${status.replaceAll('_', ' ')} Orders` : 'All Production Orders'}
            </div>
            <div className="section-sub">Newest production orders first</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Design</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Quantity</th>
                <th>Target</th>
                <th>Progress</th>
                <th>Current stage</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const completedStages = job.StageLog.length
                const isDirectOrder = !job.design
                const totalStages = job.design?._count.stages ?? 1
                const progress = isDirectOrder
                  ? job.outputRecordedAt ? 100 : 0
                  : totalStages > 0 ? Math.min(100, (completedStages / totalStages) * 100) : 0

                return (
                  <tr key={job.id}>
                    <td>
                      <Link href={`/jobs/${job.id}`} style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                        {job.orderNumber}
                      </Link>
                    </td>
                    <td>{job.design?.name ?? job.productName ?? 'Direct order'}</td>
                    <td>
                      <span className={`badge ${PRODUCTION_STATUS_BADGE_CLASS[job.status]}`}>
                        {job.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${PRIORITY_BADGE_CLASS[job.priority] ?? 'badge-muted'}`}>
                        {job.priority}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{job.quantity.toLocaleString()}</td>
                    <td><span className="job-kg">{job.targetKg.toNumber().toLocaleString()} kg</span></td>
                    <td>
                      <div style={{ minWidth: '110px' }}>
                        <div className="section-sub">
                          {isDirectOrder ? (job.outputRecordedAt ? 'Output recorded' : 'Awaiting output') : `${completedStages}/${totalStages} stages`}
                        </div>
                        <div style={{ height: '4px', marginTop: '5px', overflow: 'hidden', background: 'var(--border2)', borderRadius: '4px' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--teal)' }} />
                        </div>
                      </div>
                    </td>
                    <td>{job.currentDept || (job.status === 'COMPLETED' ? 'Completed' : isDirectOrder ? 'Production output' : `Stage ${job.currentStage}`)}</td>
                    <td>{job.createdAt.toLocaleDateString()}</td>
                    <td><Link href={`/jobs/${job.id}`} className="btn btn-ghost btn-sm">View details</Link></td>
                  </tr>
                )
              })}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                    No production orders match this status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="section-header" style={{ marginTop: '16px' }}>
          <div className="section-sub">Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            {page > 1 && <Link href={buildHref(status, page - 1)} className="btn btn-ghost">Previous</Link>}
            {page < totalPages && <Link href={buildHref(status, page + 1)} className="btn btn-ghost">Next</Link>}
          </div>
        </div>
      )}
    </div>
  )
}
