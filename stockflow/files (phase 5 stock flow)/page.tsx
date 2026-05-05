import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { BRANCH_LABELS } from '@/lib/branches'
import { STATUS_BADGE_CLASS, STATUS_LABELS, formatKES } from '@/lib/sales'
import type { Branch, SalesOrderStatus } from '@prisma/client'

const PAGE_SIZE = 50

export default async function SalesPage({
  searchParams,
}: {
  searchParams: { branch?: string; status?: string; q?: string; page?: string }
}) {
  const branch = searchParams.branch as Branch | undefined
  const status = searchParams.status as SalesOrderStatus | undefined
  const q = searchParams.q?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))

  const where: any = {}
  if (branch) where.branch = branch
  if (status) where.status = status
  if (q) {
    where.OR = [
      { order_number: { contains: q, mode: 'insensitive' } },
      { customer_name: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [orders, total, summaryByBranch] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy: { invoice_date: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        lines: { select: { total_amount: true } },
        created_by_user: { select: { full_name: true } },
      },
    }),
    prisma.salesOrder.count({ where }),
    prisma.salesOrder.groupBy({
      by: ['branch'],
      where: { status: { in: ['invoiced', 'fulfilled'] } },
      _count: { _all: true },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const branchCounts = Object.fromEntries(
    summaryByBranch.map((s) => [s.branch, s._count._all])
  )

  function buildHref(overrides: { branch?: string; status?: string; q?: string; page?: number }) {
    const params = new URLSearchParams()
    const _branch = overrides.branch ?? branch
    const _status = overrides.status ?? status
    const _q = overrides.q ?? q
    const _page = overrides.page ?? page
    if (_branch) params.set('branch', _branch)
    if (_status) params.set('status', _status)
    if (_q) params.set('q', _q)
    if (_page > 1) params.set('page', String(_page))
    const qs = params.toString()
    return qs ? `/sales?${qs}` : '/sales'
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-head text-2xl font-bold">Sales orders</h1>
          <p className="text-muted text-sm mt-1">
            {total} {total === 1 ? 'order' : 'orders'} matching filters
          </p>
        </div>
        <Link href="/sales/new" className="btn btn-primary">
          + New sale
        </Link>
      </div>

      {/* BRANCH FILTER PILLS */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Link
          href={buildHref({ branch: '', page: 1 })}
          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
            !branch
              ? 'bg-accent border-accent text-bg font-semibold'
              : 'bg-surface border-border text-muted hover:border-accent hover:text-text'
          }`}
        >
          All branches
        </Link>
        {(['mombasa', 'nairobi', 'bonje'] as const).map((b) => (
          <Link
            key={b}
            href={buildHref({ branch: b, page: 1 })}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
              branch === b
                ? 'bg-accent border-accent text-bg font-semibold'
                : 'bg-surface border-border text-muted hover:border-accent hover:text-text'
            }`}
          >
            {BRANCH_LABELS[b]} {branchCounts[b] ? `· ${branchCounts[b]}` : ''}
          </Link>
        ))}
      </div>

      {/* STATUS FILTER PILLS */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Link
          href={buildHref({ status: '', page: 1 })}
          className={`px-2.5 py-1 rounded-full text-[11px] border ${
            !status
              ? 'bg-surface2 border-border2 text-text'
              : 'bg-surface border-border text-muted hover:border-accent'
          }`}
        >
          All statuses
        </Link>
        {(['draft', 'invoiced', 'fulfilled', 'cancelled'] as const).map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s, page: 1 })}
            className={`px-2.5 py-1 rounded-full text-[11px] border capitalize ${
              status === s
                ? 'bg-surface2 border-border2 text-text'
                : 'bg-surface border-border text-muted hover:border-accent'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <form className="mb-4">
        {branch && <input type="hidden" name="branch" value={branch} />}
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by invoice number or customer..."
          className="input max-w-md"
        />
      </form>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted text-sm">
                    {(q || branch || status) ? (
                      <>No orders match these filters. <Link href="/sales" className="text-accent">Clear</Link></>
                    ) : (
                      <>No sales yet. <Link href="/sales/new" className="text-accent">Record your first sale</Link>.</>
                    )}
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const total = o.lines.reduce((sum, l) => sum + Number(l.total_amount), 0)
                  return (
                    <tr key={o.id} className="border-b border-border last:border-b-0 hover:bg-surface2">
                      <td className="px-4 py-3">
                        <Link href={`/sales/${o.id}`} className="font-mono text-accent hover:underline">
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {new Date(o.invoice_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 truncate max-w-xs">{o.customer_name}</td>
                      <td className="px-4 py-3 text-xs capitalize">{o.branch}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[o.status]}`}>
                          {STATUS_LABELS[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatKES(total)}</td>
                      <td className="px-4 py-3 text-xs text-muted">{o.created_by_user.full_name}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
            <div className="text-muted">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </div>
            <div className="flex gap-2">
              {page > 1 && <Link href={buildHref({ page: page - 1 })} className="btn btn-ghost btn-sm">← Previous</Link>}
              {page < totalPages && <Link href={buildHref({ page: page + 1 })} className="btn btn-ghost btn-sm">Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
