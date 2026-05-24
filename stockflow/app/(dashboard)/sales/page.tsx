import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { BRANCH_LABELS } from '@/lib/branches'
import { STATUS_BADGE_CLASS, STATUS_LABELS, formatKES } from '@/lib/sales-utils'
import type { BranchCode as Branch } from '@/lib/branches'
import type { SaleStatus as SalesOrderStatus } from '@prisma/client'

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const branch = params.branch as Branch | undefined
  const status = params.status as SalesOrderStatus | undefined
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page ?? 1))

  const where: any = {}
  if (status) where.status = status
  if (q) {
    where.OR = [
      { id: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
    ]
  }

   const [orders, total] = await Promise.all([
     prisma.saleOrder.findMany({
       where,
       orderBy: { createdAt: 'desc' },
       take: PAGE_SIZE,
       skip: (page - 1) * PAGE_SIZE,
       include: {
         SaleItem: { select: { totalPrice: true } },
         createdByUser: { select: { name: true, branchId: true } },
       },
     }),
     prisma.saleOrder.count({ where }),
   ])
   
    // Calculate summary by branch
    const branchCountMap: Record<string, number> = {}
    for (const order of orders) {
      const b = order.createdByUser?.branchId ?? 'unknown'
      branchCountMap[b] = (branchCountMap[b] ?? 0) + 1
    }
    
    const summaryByBranch = Object.entries(branchCountMap).map(([b, count]) => ({
      branch: b === 'unknown' ? null : b,
      _count: { _all: count }
    }))
 
   const totalPages = Math.ceil(total / PAGE_SIZE)
   const branchCounts: Record<string, number> = Object.fromEntries(
     summaryByBranch.map((s) => [s.branch ?? 'unknown', s._count._all])
   )

  function buildHref(overrides: { status?: string; q?: string; page?: number; branch?: string }) {
    const params = new URLSearchParams()
    const _status = overrides.status ?? status
    const _q = overrides.q ?? q
    const _page = overrides.page ?? page
    const _branch = overrides.branch ?? branch
    if (_status) params.set('status', _status)
    if (_q) params.set('q', _q)
    if (_branch) params.set('branch', _branch)
    if (_page > 1) params.set('page', String(_page))
    const qs = params.toString()
    return qs ? `/sales?${qs}` : '/sales'
  }

  // Show dashboard view when no filters
  const isDashboardView = !branch && !status && !q

  if (isDashboardView) {
    return (
      <div>
        <div className="section-header mb-16">
          <div><div className="section-title">Sales Team Dashboard</div><div className="section-sub">Manage orders and view available stock</div></div>
        </div>

        <div className="grid-2 mb-16">
          <div className="card">
            <div className="section-header mb-16"><div className="section-title">Available stock</div><Link href="/catalogue" className="btn btn-ghost btn-sm">View catalogue</Link></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px'}}>
              <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px',textAlign:'center'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'20px',color:'var(--teal)',marginBottom:'4px'}}>1,340 kg</div>
                <div style={{fontSize:'11px',color:'var(--muted)'}}>Finished goods ready</div>
              </div>
              <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px',textAlign:'center'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'20px',color:'var(--teal)',marginBottom:'4px'}}>247 units</div>
                <div style={{fontSize:'11px',color:'var(--muted)'}}>Across 6 designs</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="section-header mb-16"><div className="section-title">Recent orders</div><Link href="/sales" className="btn btn-ghost btn-sm">View all</Link></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Order ID</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {orders.slice(0, 4).map((o) => {
                    const total = o.SaleItem.reduce((sum, item) => sum + Number(item.totalPrice), 0)
                    return (
                      <tr key={o.id}>
                        <td><Link href={`/sales/${o.id}`} style={{fontFamily:'var(--font-mono)',color:'var(--accent)'}}>{o.id.slice(-8)}</Link></td>
                        <td>{o.customerName}</td>
                        <td style={{fontFamily:'var(--font-mono)'}}>{formatKES(Number(total))}</td>
                        <td><span className={`badge ${STATUS_BADGE_CLASS[o.status] || 'badge-muted'}`}>{STATUS_LABELS[o.status] || o.status}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Sales Orders</div>
          <div className="section-sub">
            {total} {total === 1 ? 'order' : 'orders'} matching filters
          </div>
        </div>
        <Link href="/sales/new" className="btn btn-primary">
          + New Sale
        </Link>
      </div>

      {/* BRANCH FILTER PILLS */}
      <div className="section-header mb-6">
        <div className="section-title">Filter by Branch</div>
        <div className="section-sub">Currently showing all branches</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href={buildHref({ branch: '', page: 1 })}
          className={`btn ${!branch ? 'btn-primary' : 'btn-secondary'}`}
        >
          All Branches
        </Link>
        {(['mombasa', 'nairobi', 'bonje'] as const).map((b) => (
          <Link
            key={b}
            href={buildHref({ branch: b, page: 1 })}
            className={`btn ${branch === b ? 'btn-primary' : 'btn-secondary'}`}
          >
            {BRANCH_LABELS[b]}
          </Link>
        ))}
      </div>

      {/* STATUS FILTER PILLS */}
      <div className="section-header mb-6">
        <div className="section-title">Filter by Status</div>
        <div className="section-sub">Click any status to filter orders</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-16">
        <Link
          href={buildHref({ status: '', page: 1 })}
          className={`btn ${!status ? 'btn-primary' : 'btn-secondary'}`}
        >
          All Statuses
        </Link>
        {(['PENDING', 'CONFIRMED', 'SHIPPED', 'CANCELLED'] as const).map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s, page: 1 })}
            className={`btn ${status === s ? 'btn-primary' : 'btn-secondary'}`}
          >
            {s.replace('_', ' ')}
          </Link>
        ))}
      </div>

      {/* SEARCH FORM */}
      <div className="section-header mb-8">
        <div className="section-title">Search Orders</div>
        <div className="section-sub">Find orders by ID or customer name</div>
      </div>

      <form className="mb-16">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="form-group max-w-md">
          <label className="form-label">Search</label>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by order ID or customer name..."
            className="form-input"
          />
        </div>
      </form>

      {/* SALES ORDERS TABLE */}
      <div className="section-header mb-8">
        <div className="section-title">
          {status ? `${status.replace('_', ' ')} Orders` : 'All Sales Orders'}
        </div>
        <div className="section-sub">
          {q ? `Search results for "${q}"` : `${total} orders found`}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted text-sm">
                    {(q || status) ? (
                      <div>
                        No orders match your search criteria.{' '}
                        <Link href="/sales" className="text-accent-amber hover:underline">
                          Clear filters
                        </Link>
                      </div>
                    ) : (
                      <div>
                        No sales orders found.{' '}
                        <Link href="/sales/new" className="text-accent-amber hover:underline">
                          Create your first sale
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const total = o.SaleItem.reduce((sum, item) => sum + Number(item.totalPrice), 0)
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/sales/${o.id}`} className="font-mono text-accent-amber hover:underline">
                          {o.id.slice(-8)}
                        </Link>
                      </td>
                      <td className="text-muted text-sm whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="truncate max-w-xs">{o.customerName}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE_CLASS[o.status] || 'badge-muted'}`}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className="text-right font-mono">{formatKES(Number(total))}</td>
                      <td className="text-muted text-sm">{o.createdByUser?.name || 'System'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="text-muted text-sm">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} orders
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={buildHref({ page: page - 1 })} className="btn btn-secondary">
                  Previous
                </Link>
              )}
              <span className="px-4 py-2 bg-surface-secondary border border-border rounded-md text-muted text-sm">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link href={buildHref({ page: page + 1 })} className="btn btn-secondary">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}