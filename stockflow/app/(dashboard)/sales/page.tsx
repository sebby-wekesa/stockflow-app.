import Link from 'next/link'
import type { Prisma, SaleStatus } from '@prisma/client'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { STATUS_BADGE_CLASS, STATUS_LABELS, formatKES } from '@/lib/sales-utils'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const STATUSES: SaleStatus[] = ['PENDING', 'CONFIRMED', 'READY_FOR_DISPATCH', 'SHIPPED', 'CANCELLED']

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  const params = await searchParams
  const status = STATUSES.includes(params.status as SaleStatus) ? params.status as SaleStatus : undefined
  const branch = params.branch?.trim() || undefined
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page ?? 1))

  const baseWhere: Prisma.SaleOrderWhereInput = user.role === 'SALES' ? { createdBy: user.id } : {}
  const where: Prisma.SaleOrderWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
    ...(branch ? { createdByUser: { Branch: { code: branch } } } : {}),
    ...(q ? {
      OR: [
        { id: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
      ],
    } : {}),
  }

  const [orders, total, statusCounts, revenue, branches] = await Promise.all([
    db.saleOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        SaleItem: { select: { quantity: true } },
        createdByUser: { select: { name: true, Branch: { select: { name: true, code: true } } } },
      },
    }),
    db.saleOrder.count({ where }),
    db.saleOrder.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    db.saleOrder.aggregate({
      where: { ...baseWhere, status: { in: ['CONFIRMED', 'READY_FOR_DISPATCH', 'SHIPPED'] } },
      _sum: { totalAmount: true },
    }),
    db.branch.findMany({ orderBy: { name: 'asc' }, select: { code: true, name: true } }),
  ])

  const countByStatus = new Map(statusCounts.map((item) => [item.status, item._count._all]))
  const allOrders = statusCounts.reduce((sum, item) => sum + item._count._all, 0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildHref(overrides: { status?: string; q?: string; page?: number; branch?: string }) {
    const next = new URLSearchParams()
    const nextStatus = overrides.status ?? status
    const nextQ = overrides.q ?? q
    const nextPage = overrides.page ?? page
    const nextBranch = overrides.branch ?? branch
    if (nextStatus) next.set('status', nextStatus)
    if (nextQ) next.set('q', nextQ)
    if (nextBranch) next.set('branch', nextBranch)
    if (nextPage > 1) next.set('page', String(nextPage))
    const value = next.toString()
    return value ? `/sales?${value}` : '/sales'
  }

  return (
    <div className="sales-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Sales Orders</div>
          <div className="section-sub">Search and track customer orders from the sales database</div>
        </div>
        <Link href="/sales/new" className="btn btn-primary">+ New sales order</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-label">Total orders</div>
          <div className="stat-value">{allOrders.toLocaleString()}</div>
          <div className="stat-sub">All recorded sales orders</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Confirmed</div>
          <div className="stat-value">{(countByStatus.get('CONFIRMED') ?? 0).toLocaleString()}</div>
          <div className="stat-sub">Reserved for fulfilment</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Confirmed revenue</div>
          <div className="stat-value sales-money">{formatKES(Number(revenue._sum.totalAmount ?? 0))}</div>
          <div className="stat-sub">Confirmed through shipped</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Shipped</div>
          <div className="stat-value">{(countByStatus.get('SHIPPED') ?? 0).toLocaleString()}</div>
          <div className="stat-sub">Completed deliveries</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Filter Orders</div>
            <div className="section-sub">Filter by workflow status, branch, or customer</div>
          </div>
          <span className="badge badge-muted">{total.toLocaleString()} results</span>
        </div>

        <div className="sales-filter-group">
          <div className="form-label">Status</div>
          <div className="flex flex-wrap gap-2">
            <Link href={buildHref({ status: '', page: 1 })} className={`btn ${!status ? 'btn-primary' : 'btn-ghost'}`}>All ({allOrders})</Link>
            {STATUSES.map((item) => (
              <Link key={item} href={buildHref({ status: item, page: 1 })} className={`btn ${status === item ? 'btn-primary' : 'btn-ghost'}`}>
                {STATUS_LABELS[item]} ({countByStatus.get(item) ?? 0})
              </Link>
            ))}
          </div>
        </div>

        {branches.length > 0 && (
          <div className="sales-filter-group">
            <div className="form-label">Branch</div>
            <div className="flex flex-wrap gap-2">
              <Link href={buildHref({ branch: '', page: 1 })} className={`btn ${!branch ? 'btn-primary' : 'btn-ghost'}`}>All branches</Link>
              {branches.map((item) => (
                <Link key={item.code} href={buildHref({ branch: item.code, page: 1 })} className={`btn ${branch === item.code ? 'btn-primary' : 'btn-ghost'}`}>
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <form className="sales-search-form">
          {status && <input type="hidden" name="status" value={status} />}
          {branch && <input type="hidden" name="branch" value={branch} />}
          <div className="form-group">
            <label className="form-label">Order or customer</label>
            <input type="search" name="q" defaultValue={q} placeholder="Search order number or customer name..." className="form-input" />
          </div>
          <button className="btn btn-primary" type="submit">Search</button>
          {(q || status || branch) && <Link href="/sales" className="btn btn-ghost">Clear filters</Link>}
        </form>
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">{status ? `${STATUS_LABELS[status]} Orders` : 'Order History'}</div>
            <div className="section-sub">Newest orders first</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Branch</th><th>Items</th><th>Status</th><th>Amount</th><th>Created by</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/sales/${order.id}`} className="sales-order-link">{order.id}</Link></td>
                  <td className="section-sub">{order.createdAt.toLocaleDateString()}</td>
                  <td>{order.customerName}</td>
                  <td>{order.createdByUser?.Branch?.name ?? 'Unassigned'}</td>
                  <td>{order.SaleItem.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}</td>
                  <td><span className={`badge ${STATUS_BADGE_CLASS[order.status]}`}>{STATUS_LABELS[order.status]}</span></td>
                  <td><span className="job-kg">{formatKES(Number(order.totalAmount))}</span></td>
                  <td className="section-sub">{order.createdByUser?.name ?? 'System'}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={8} className="sales-empty">No sales orders match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="sales-pagination">
            <span className="section-sub">Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={buildHref({ page: page - 1 })} className="btn btn-ghost">Previous</Link>}
              <span className="badge badge-muted">Page {page} of {totalPages}</span>
              {page < totalPages && <Link href={buildHref({ page: page + 1 })} className="btn btn-ghost">Next</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
