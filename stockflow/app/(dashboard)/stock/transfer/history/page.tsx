import Link from 'next/link'
import type { Prisma, StockTransferStatus } from '@prisma/client'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { normalizeBranchCode } from '@/lib/branches'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const STATUSES: StockTransferStatus[] = ['PENDING', 'RECEIVED']
const STATUS_LABELS: Record<StockTransferStatus, string> = {
  PENDING: 'Awaiting receipt',
  RECEIVED: 'Received',
}
const STATUS_BADGE_CLASSES: Record<StockTransferStatus, string> = {
  PENDING: 'badge-amber',
  RECEIVED: 'badge-teal',
}

function quantityUnitLabel(quantityUnit: string) {
  return quantityUnit === 'KG' ? 'KG' : 'PCS/Sets'
}

export default async function StockTransferHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; branch?: string; q?: string; page?: string }>
}) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  const params = await searchParams

  const status = STATUSES.includes(params.status as StockTransferStatus)
    ? params.status as StockTransferStatus
    : undefined
  const branch = params.branch?.trim() || undefined
  const q = params.q?.trim() ?? ''
  const parsedPage = Number(params.page ?? 1)
  const page = Number.isFinite(parsedPage) ? Math.max(1, Math.floor(parsedPage)) : 1

  const branchRecords = await db.branch.findMany({
    select: { id: true, name: true, code: true, location: true },
    orderBy: { name: 'asc' },
  })

  const canSeeAllBranches = user.role === 'ADMIN' || user.role === 'MANAGER'
  const visibleBranchIds = canSeeAllBranches
    ? branchRecords.map((record) => record.id)
    : user.branches.map((userBranch) => userBranch.id)
  const visibleBranches = canSeeAllBranches
    ? branchRecords
    : branchRecords.filter((record) => visibleBranchIds.includes(record.id))
  const selectedBranch = branch
    ? visibleBranches.find((record) => normalizeBranchCode(record.code, record.name, record.location) === normalizeBranchCode(branch))
    : undefined

  // Managers and admins can review the organization-wide trail. Other users
  // see only transfers touching a branch assigned to them.
  const visibilityWhere: Prisma.StockTransferWhereInput = canSeeAllBranches
    ? {}
    : {
        OR: [
          { sourceBranchId: { in: visibleBranchIds } },
          { destinationBranchId: { in: visibleBranchIds } },
        ],
      }

  const filterWhere: Prisma.StockTransferWhereInput = {
    AND: [
      visibilityWhere,
      ...(status ? [{ status }] : []),
      ...(branch
        ? [{
            OR: selectedBranch
              ? [
                  { sourceBranchId: selectedBranch.id },
                  { destinationBranchId: selectedBranch.id },
                ]
              : [{ sourceBranchId: '__unknown_branch__' }],
          }]
        : []),
      ...(q
        ? [{
            OR: [
              { reference: { contains: q, mode: 'insensitive' as const } },
              { Product: { is: { sku: { contains: q, mode: 'insensitive' as const } } } },
              { Product: { is: { name: { contains: q, mode: 'insensitive' as const } } } },
              { notes: { contains: q, mode: 'insensitive' as const } },
            ],
          }]
        : []),
    ],
  }

  const [transfers, total, statusCounts] = await Promise.all([
    db.stockTransfer.findMany({
      where: filterWhere,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        Product: { select: { sku: true, name: true } },
        SourceBranch: { select: { name: true } },
        DestinationBranch: { select: { name: true } },
        ReceivedBy: { select: { name: true } },
      },
    }),
    db.stockTransfer.count({ where: filterWhere }),
    db.stockTransfer.groupBy({
      by: ['status'],
      where: visibilityWhere,
      _count: { _all: true },
    }),
  ])

  const countByStatus = new Map(statusCounts.map((item) => [item.status, item._count._all]))
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildHref(overrides: { status?: string; branch?: string; q?: string; page?: number }) {
    const next = new URLSearchParams()
    const nextStatus = overrides.status ?? status
    const nextBranch = overrides.branch ?? branch
    const nextQ = overrides.q ?? q
    const nextPage = overrides.page ?? page
    if (nextStatus) next.set('status', nextStatus)
    if (nextBranch) next.set('branch', nextBranch)
    if (nextQ) next.set('q', nextQ)
    if (nextPage > 1) next.set('page', String(nextPage))
    const queryString = next.toString()
    return queryString ? `/stock/transfer/history?${queryString}` : '/stock/transfer/history'
  }

  return (
    <div className="sales-page">
      <div className="section-header mb-16">
        <div>
          <Link href="/stock" className="stock-transfer-back">← Stock overview</Link>
          <div className="section-title">Stock transfer history</div>
          <div className="section-sub">Review every branch-to-branch dispatch and receipt.</div>
        </div>
        <Link href="/stock/transfer" className="btn btn-primary">+ Transfer stock</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-label">Transfers recorded</div>
          <div className="stat-value">{((countByStatus.get('PENDING') ?? 0) + (countByStatus.get('RECEIVED') ?? 0)).toLocaleString()}</div>
          <div className="stat-sub">All transfers in your view</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Awaiting receipt</div>
          <div className="stat-value">{(countByStatus.get('PENDING') ?? 0).toLocaleString()}</div>
          <div className="stat-sub">Dispatched, not yet confirmed</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Received</div>
          <div className="stat-value">{(countByStatus.get('RECEIVED') ?? 0).toLocaleString()}</div>
          <div className="stat-sub">Confirmed at destination</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Filter transfers</div>
            <div className="section-sub">Search by reference, product, note, status, or branch.</div>
          </div>
          <span className="badge badge-muted">{total.toLocaleString()} results</span>
        </div>

        <form className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="form-group">
            <label className="form-label" htmlFor="transfer-history-search">Search</label>
            <input
              id="transfer-history-search"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Reference, SKU, or note..."
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="transfer-history-status">Status</label>
            <select id="transfer-history-status" name="status" defaultValue={status ?? ''} className="form-input">
              <option value="">All statuses</option>
              {STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="transfer-history-branch">Branch</label>
            <select id="transfer-history-branch" name="branch" defaultValue={branch ?? ''} className="form-input">
              <option value="">All branches</option>
              {visibleBranches.map((item) => {
                const code = normalizeBranchCode(item.code, item.name, item.location)
                return code ? <option key={item.id} value={code}>{item.name}</option> : null
              })}
            </select>
          </div>
          <div className="form-group flex items-end gap-2">
            <button className="btn btn-primary" type="submit">Search</button>
            {(q || status || branch) && <Link href="/stock/transfer/history" className="btn btn-ghost">Clear</Link>}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Transfer log</div>
            <div className="section-sub">Newest transfers first</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Product</th>
                <th>Route</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td className="sales-order-link">{transfer.reference}</td>
                  <td className="section-sub">{transfer.createdAt.toLocaleString('en-KE')}</td>
                  <td>
                    <div>{transfer.Product.name}</div>
                    <div className="section-sub">{transfer.Product.sku ?? 'No SKU'}</div>
                  </td>
                  <td>{transfer.SourceBranch.name} → {transfer.DestinationBranch.name}</td>
                  <td className="job-kg">{transfer.quantity.toLocaleString()} {quantityUnitLabel(transfer.quantityUnit)}</td>
                  <td><span className={`badge ${STATUS_BADGE_CLASSES[transfer.status]}`}>{STATUS_LABELS[transfer.status]}</span></td>
                  <td className="section-sub">
                    {transfer.receivedAt
                      ? <>{transfer.receivedAt.toLocaleString('en-KE')}<br />{transfer.ReceivedBy?.name ?? 'System'}</>
                      : '—'}
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && <tr><td colSpan={7} className="sales-empty">No stock transfers match the selected filters.</td></tr>}
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
