import Link from 'next/link'
import type { AuthUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { STATUS_BADGE_CLASS, STATUS_LABELS, formatKES } from '@/lib/sales-utils'

export default async function SalesDashboard({ user }: { user: AuthUser }) {
  const db = getTenantPrisma(user.organizationId)
  const where = user.role === 'SALES' ? { createdBy: user.id } : {}

  const [orders, statusCounts, revenue, stock, designs] = await Promise.all([
    db.saleOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { SaleItem: { select: { quantity: true } } },
    }),
    db.saleOrder.groupBy({ by: ['status'], where, _count: { _all: true } }),
    db.saleOrder.aggregate({
      where: { ...where, status: { in: ['CONFIRMED', 'READY_FOR_DISPATCH', 'SHIPPED'] } },
      _sum: { totalAmount: true },
    }),
    db.finishedGoods.aggregate({ _sum: { quantity: true, kgProduced: true } }),
    db.finishedGoods.findMany({
      where: { quantity: { gt: 0 } },
      distinct: ['designId'],
      select: { designId: true },
    }),
  ])

  const countByStatus = new Map(statusCounts.map((item) => [item.status, item._count._all]))
  const totalOrders = statusCounts.reduce((sum, item) => sum + item._count._all, 0)
  const openOrders = (countByStatus.get('PENDING') ?? 0) + (countByStatus.get('CONFIRMED') ?? 0)

  return (
    <div className="sales-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Sales Dashboard</div>
          <div className="section-sub">Live orders, revenue, and available finished goods</div>
        </div>
        <Link href="/sales/new" className="btn btn-primary">+ New sales order</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-label">Sales orders</div>
          <div className="stat-value">{totalOrders.toLocaleString()}</div>
          <div className="stat-sub">{openOrders.toLocaleString()} pending or confirmed</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Confirmed revenue</div>
          <div className="stat-value sales-money">{formatKES(Number(revenue._sum.totalAmount ?? 0))}</div>
          <div className="stat-sub">Confirmed through shipped orders</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Available finished goods</div>
          <div className="stat-value">{Number(stock._sum.quantity ?? 0).toLocaleString()}</div>
          <div className="stat-sub">Units across {designs.length.toLocaleString()} designs</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Ready for dispatch</div>
          <div className="stat-value">{(countByStatus.get('READY_FOR_DISPATCH') ?? 0).toLocaleString()}</div>
          <div className="stat-sub">{Number(stock._sum.kgProduced ?? 0).toLocaleString()} kg recorded</div>
        </div>
      </div>

      <div className="grid-2 sales-dashboard-grid">
        <div className="card">
          <div className="section-header mb-16">
            <div><div className="section-title">Order Pipeline</div><div className="section-sub">Current sales workflow</div></div>
          </div>
          <div className="sales-pipeline">
            {(['PENDING', 'CONFIRMED', 'READY_FOR_DISPATCH', 'SHIPPED'] as const).map((status) => (
              <Link key={status} href={`/sales?status=${status}`} className="sales-pipeline-row">
                <span className={`badge ${STATUS_BADGE_CLASS[status]}`}>{STATUS_LABELS[status]}</span>
                <strong>{(countByStatus.get(status) ?? 0).toLocaleString()}</strong>
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header mb-16">
            <div><div className="section-title">Quick Actions</div><div className="section-sub">Common sales workflows</div></div>
          </div>
          <div className="sales-actions">
            <Link href="/sales/new" className="sales-action-card"><strong>Create sales order</strong><span>Record a customer order or invoice</span></Link>
            <Link href="/sales" className="sales-action-card"><strong>Review order history</strong><span>Search and track all sales orders</span></Link>
            <Link href="/catalogue" className="sales-action-card"><strong>View available stock</strong><span>Browse products ready for sale</span></Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div><div className="section-title">Recent Orders</div><div className="section-sub">Newest orders from the sales database</div></div>
          <Link href="/sales" className="btn btn-ghost btn-sm">View all →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/sales/${order.id}`} className="sales-order-link">{order.id}</Link></td>
                  <td>{order.customerName}</td>
                  <td>{order.SaleItem.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}</td>
                  <td><span className="job-kg">{formatKES(Number(order.totalAmount))}</span></td>
                  <td><span className={`badge ${STATUS_BADGE_CLASS[order.status]}`}>{STATUS_LABELS[order.status]}</span></td>
                  <td className="section-sub">{order.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={6} className="sales-empty">No sales orders have been created yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
