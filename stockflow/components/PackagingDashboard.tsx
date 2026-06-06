import Link from 'next/link'
import {
  dispatchCompletedProductionWork,
  getPackagingDashboardData,
  markCompletedProductionReadyForDispatch,
  startCompletedProductionPackaging,
} from '@/app/actions/packaging'
import { formatKES } from '@/lib/sales-utils'
import { PackagingQueue } from '@/components/PackagingQueue'

export default async function PackagingDashboard() {
  const data = await getPackagingDashboardData()
  const nextReadyOrder = data.readyForDispatch[0]

  return (
    <div className="packaging-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Packaging Dashboard</div>
          <div className="section-sub">Pack confirmed orders, manage dispatch handoff, and track shipped work</div>
        </div>
        <div className="packaging-actions">
          <Link href="/pack_done" className="btn btn-primary">Dispatch queue</Link>
        </div>
      </div>

      <div className="stats-grid packaging-stats">
        <div className="stat-card blue">
          <div className="stat-label">Operator work complete</div>
          <div className="stat-value">{data.stats.completedOperatorWork.toLocaleString()}</div>
          <div className="stat-sub">Completed production orders from all operators</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Ready for dispatch</div>
          <div className="stat-value">{data.stats.readyForDispatch.toLocaleString()}</div>
          <div className="stat-sub">Packaged orders awaiting handoff</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Shipped today</div>
          <div className="stat-value">{data.stats.shippedToday.toLocaleString()}</div>
          <div className="stat-sub">Orders dispatched from packaging</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Shipped this week</div>
          <div className="stat-value packaging-money">{formatKES(data.stats.weeklyRevenue)}</div>
          <div className="stat-sub">Value of completed dispatches</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Completed Operator Work</div>
            <div className="section-sub">All completed production jobs available to packaging</div>
          </div>
        </div>
        <div className="packaging-list">
          {data.completedProductionWork.map((work) => (
            <div className="packaging-row" key={work.id}>
              <div>
                <div className="pack-order">
                  {work.orderNumber} · {new Date(work.completedAt).toLocaleDateString()}
                </div>
                <div className="pack-product">{work.productName}</div>
                <div className="pack-detail">
                  {work.department} · {work.operatorName}
                  {work.customerName ? ` · ${work.customerName}` : ''}
                </div>
              </div>
              <span className={`badge ${
                work.packagingStatus === 'READY_FOR_DISPATCH'
                  ? 'badge-amber'
                  : work.packagingStatus === 'IN_PACKAGING'
                    ? 'badge-blue'
                    : 'badge-muted'
              }`}>
                {work.packagingStatus === 'READY_FOR_DISPATCH'
                  ? 'Ready for dispatch'
                  : work.packagingStatus === 'IN_PACKAGING'
                    ? 'In packaging'
                    : 'Awaiting packaging'}
              </span>
              <span className="job-kg">
                {work.piecesOut.toLocaleString()} pcs/sets · {work.kgOut.toFixed(1)} kg
              </span>
              <div className="pack-actions">
                {work.packagingStatus === 'AWAITING_PACKAGING' && (
                  <form action={async () => {
                    'use server'
                    await startCompletedProductionPackaging(work.id)
                  }}>
                    <button type="submit" className="btn btn-blue btn-sm">Start packaging</button>
                  </form>
                )}
                {work.packagingStatus === 'IN_PACKAGING' && (
                  <form action={async () => {
                    'use server'
                    await markCompletedProductionReadyForDispatch(work.id)
                  }}>
                    <button type="submit" className="btn btn-primary btn-sm">Mark ready</button>
                  </form>
                )}
                {work.packagingStatus === 'READY_FOR_DISPATCH' && (
                  <form action={async () => {
                    'use server'
                    await dispatchCompletedProductionWork(work.id)
                  }}>
                    <button type="submit" className="btn btn-teal btn-sm">Dispatch</button>
                  </form>
                )}
              </div>
            </div>
          ))}
          {data.completedProductionWork.length === 0 && (
            <div className="packaging-empty">No completed operator work is available.</div>
          )}
        </div>
      </div>

      <div className="grid-2 packaging-overview mb-16">
        <div className="card">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">Dispatch Handoff</div>
              <div className="section-sub">Newest packaged orders ready to leave</div>
            </div>
            <Link href="/pack_done" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          {nextReadyOrder ? (
            <div className="packaging-focus">
              <div>
                <div className="pack-order">{nextReadyOrder.orderNumber}</div>
                <div className="pack-product">{nextReadyOrder.customerName}</div>
                <div className="pack-detail">
                  {nextReadyOrder.totalQuantity.toLocaleString()} units · {nextReadyOrder.totalKg.toFixed(0)} kg
                </div>
              </div>
              <span className="badge badge-amber">{formatKES(nextReadyOrder.totalAmount)}</span>
            </div>
          ) : (
            <div className="packaging-empty">No packaged orders are waiting for dispatch.</div>
          )}
        </div>

        <div className="card">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">Recent Shipments</div>
              <div className="section-sub">Latest orders marked shipped</div>
            </div>
          </div>
          <div className="packaging-list">
            {data.recentShipments.slice(0, 4).map((order) => (
              <div className="packaging-row" key={order.id}>
                <div>
                  <div className="pack-order">{order.orderNumber}</div>
                  <div className="pack-product">{order.customerName}</div>
                </div>
                <span className="job-kg">{formatKES(order.totalAmount)}</span>
              </div>
            ))}
            {data.recentShipments.length === 0 && (
              <div className="packaging-empty">No shipped orders found.</div>
            )}
          </div>
        </div>
      </div>

      <PackagingQueue orders={data.queue} initialStats={data.stats} />
    </div>
  )
}
