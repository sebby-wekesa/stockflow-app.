import Link from 'next/link'
import { requireActiveAuth } from '@/lib/auth'
import { formatKES } from '@/lib/branches'
import { getDateRange, RANGE_LABELS, type DateRangeKey } from '@/lib/reports'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { DownloadReportButton } from './_components/DownloadReportButton'

export const dynamic = 'force-dynamic'

function isDateRangeKey(value: string | undefined): value is DateRangeKey {
  return Boolean(value && value in RANGE_LABELS)
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const currentRange = isDateRangeKey(params.range) ? params.range : '30d'
  const { start, end } = getDateRange(currentRange)
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  const periodFilter = start ? { gte: start, lte: end } : undefined

  const [
    salesSummary,
    productSummary,
    rawMaterialSummary,
    completedProductionOrders,
    stageLogs,
    recentSales,
    recentProduction,
  ] = await Promise.all([
    db.saleOrder.aggregate({
      where: {
        status: { in: ['CONFIRMED', 'READY_FOR_DISPATCH', 'SHIPPED'] },
        createdAt: periodFilter,
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    db.product.aggregate({
      _count: { _all: true },
      _sum: { currentStock: true, piecesSets: true },
    }),
    db.rawMaterial.aggregate({
      _count: { _all: true },
      _sum: { availableKg: true, reservedKg: true },
    }),
    db.productionOrder.count({
      where: {
        status: 'COMPLETED',
        completedAt: periodFilter,
      },
    }),
    db.stageLog.findMany({
      where: { completedAt: periodFilter },
      select: { kgIn: true, kgOut: true, kgScrap: true },
    }),
    db.saleOrder.findMany({
      where: {
        status: { in: ['CONFIRMED', 'READY_FOR_DISPATCH', 'SHIPPED'] },
        createdAt: periodFilter,
      },
      select: {
        id: true,
        customerName: true,
        totalAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.productionOrder.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: periodFilter,
      },
      select: {
        id: true,
        orderNumber: true,
        productName: true,
        quantity: true,
        completedAt: true,
        design: { select: { name: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
    }),
  ])

  const totalKgIn = stageLogs.reduce((sum, log) => sum + Number(log.kgIn), 0)
  const totalKgOut = stageLogs.reduce((sum, log) => sum + Number(log.kgOut), 0)
  const totalScrap = stageLogs.reduce((sum, log) => sum + Number(log.kgScrap), 0)
  const yieldRate = totalKgIn > 0 ? (totalKgOut / totalKgIn) * 100 : 0

  const reportLinks = [
    {
      title: 'Sales Report',
      description: 'Revenue, branch breakdown, top products & customers',
      href: `/api/reports/sales?range=${currentRange}`,
      filename: `sales-${currentRange}.csv`,
      icon: '📊',
    },
    {
      title: 'Stock Report',
      description: 'Current inventory levels across all branches',
      href: `/api/reports/stock?range=${currentRange}`,
      filename: `stock-report-${currentRange}.csv`,
      icon: '📦',
    },
    {
      title: 'Production Report',
      description: 'Output, scrap rate per stage and yield analysis',
      href: `/api/reports/production?range=${currentRange}`,
      filename: `production-report-${currentRange}.csv`,
      icon: '⚙️',
    },
  ]

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Reports</div>
          <div className="section-sub">Live reporting data from {user.organization.name}</div>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="card mb-16">
        <div className="section-header mb-6">
          <div className="section-title">Report Period</div>
          <div className="section-sub">Select the time range for your reports</div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.entries(RANGE_LABELS) as [DateRangeKey, string][]).map(([key, label]) => (
            <Link
              key={key}
              href={`/reports?range=${key}`}
              className={`btn ${
                currentRange === key
                  ? 'btn-primary'
                  : 'btn-secondary'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="text-muted text-sm">
          Current period: <span className="text-primary font-medium">{RANGE_LABELS[currentRange]}</span>
        </div>
      </div>

      <div className="stats-grid mb-16">
        <div className="stat-card amber">
          <div className="stat-label">Sales revenue</div>
          <div className="stat-value">{formatKES(Number(salesSummary._sum.totalAmount ?? 0))}</div>
          <div className="stat-sub">{salesSummary._count._all} confirmed or shipped orders</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Current product stock</div>
          <div className="stat-value">{Number(productSummary._sum.currentStock ?? 0).toLocaleString()}</div>
          <div className="stat-sub">
            {productSummary._count._all} products · {Number(productSummary._sum.piecesSets ?? 0).toLocaleString()} PCS/Sets
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Completed production</div>
          <div className="stat-value">{completedProductionOrders.toLocaleString()}</div>
          <div className="stat-sub">{yieldRate.toFixed(1)}% recorded stage yield</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Production scrap</div>
          <div className="stat-value">{totalScrap.toLocaleString()} kg</div>
          <div className="stat-sub">
            {Number(rawMaterialSummary._sum.availableKg ?? 0).toLocaleString()} kg raw material available
          </div>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">Recent Sales</div>
              <div className="section-sub">{RANGE_LABELS[currentRange]}</div>
            </div>
            <span className="badge badge-amber">{salesSummary._count._all} orders</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td><Link href={`/sales/${sale.id}`} style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{sale.id}</Link></td>
                    <td>{sale.customerName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatKES(Number(sale.totalAmount))}</td>
                    <td><span className={`badge ${sale.status === 'SHIPPED' ? 'badge-green' : 'badge-amber'}`}>{sale.status}</span></td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>No sales recorded for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">Recent Production</div>
              <div className="section-sub">{RANGE_LABELS[currentRange]}</div>
            </div>
            <span className="badge badge-purple">{completedProductionOrders} completed</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Order</th><th>Design</th><th>Quantity</th><th>Completed</th></tr>
              </thead>
              <tbody>
                {recentProduction.map((order) => (
                  <tr key={order.id}>
                    <td style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{order.orderNumber}</td>
                    <td>{order.design?.name ?? order.productName ?? 'Direct order'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{order.quantity.toLocaleString()}</td>
                    <td>{order.completedAt?.toLocaleDateString() ?? '—'}</td>
                  </tr>
                ))}
                {recentProduction.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>No production completed for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Report Cards */}
      <div className="section-header mb-8">
        <div className="section-title">Available Reports</div>
        <div className="section-sub">Click any report to download as CSV</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportLinks.map((report) => (
          <div key={report.title} className="card group hover:border-accent transition-colors">
            <div className="p-6">
              <div className="text-3xl mb-4">{report.icon}</div>
              <h3 className="section-title mb-3">{report.title}</h3>
              <p className="text-muted text-sm mb-6 leading-relaxed">{report.description}</p>
              <DownloadReportButton
                href={report.href}
                filename={report.filename}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="p-6">
          <h4 className="section-title mb-3">Reporting Notes</h4>
          <p className="text-muted text-sm leading-relaxed">
            Sales and production metrics use the selected period. Inventory metrics show current
            database stock because inventory is a point-in-time balance. CSV exports use the same
            tenant-scoped database records.
          </p>
        </div>
      </div>
    </div>
  )
}
