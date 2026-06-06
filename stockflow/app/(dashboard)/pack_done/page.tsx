import Link from 'next/link'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { markOrderShipped } from '@/app/actions/packaging'
import { PACKAGING_DISPATCHED_DEPT } from '@/lib/packaging-workflow'
import { withRetry } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function getPiecesSets(items: Array<{ unitPrice: unknown; totalPrice: unknown }>) {
  return items.reduce((sum, item) => {
    const unitPrice = Number(item.unitPrice)
    return sum + (unitPrice > 0 ? Number(item.totalPrice) / unitPrice : 0)
  }, 0)
}

export default async function PackDonePage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const readySalesOrders = await withRetry(() =>
    db.saleOrder.findMany({
      where: {
        status: 'READY_FOR_DISPATCH',
      },
      include: {
        SaleItem: {
          include: {
            FinishedGoods: {
              include: { design: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
  )

  const shippedSalesOrders = await withRetry(() =>
    db.saleOrder.findMany({
      where: {
        status: 'SHIPPED',
        updatedAt: { gte: today },
      },
      include: {
        SaleItem: {
          include: {
            FinishedGoods: {
              include: { design: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
  )

  const dispatchedProductionWork = await withRetry(() =>
    db.productionOrder.findMany({
      where: {
        status: 'COMPLETED',
        currentDept: PACKAGING_DISPATCHED_DEPT,
        updatedAt: { gte: today },
      },
      include: {
        design: { select: { name: true, code: true } },
        saleOrder: { select: { customerName: true } },
        StageLog: {
          orderBy: { completedAt: 'desc' },
          take: 1,
          include: { User: { select: { name: true, email: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
  )

  const dispatchedCount = shippedSalesOrders.length + dispatchedProductionWork.length

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Daily Dispatch Summary</div>
          <div className="section-sub">
            {dispatchedCount} dispatched today · {readySalesOrders.length} sales orders awaiting dispatch
          </div>
        </div>
        <Link href="/packaging" className="btn btn-ghost">Packaging queue</Link>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Packaged Sales Orders Awaiting Dispatch</div>
            <div className="section-sub">{readySalesOrders.length} orders ready to leave</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Items</th><th>Quantity</th><th>PCS/Sets</th><th>Value</th><th>Action</th></tr>
            </thead>
            <tbody>
              {readySalesOrders.map((order) => (
                <tr key={order.id}>
                  <td style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{order.id}</td>
                  <td>{order.customerName}</td>
                  <td>{order.SaleItem.map((item) => item.FinishedGoods.design.name).join(', ')}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{order.SaleItem.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{getPiecesSets(order.SaleItem).toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>KES {Number(order.totalAmount).toLocaleString()}</td>
                  <td>
                    <form action={async () => { 'use server'; await markOrderShipped(order.id) }}>
                      <button className="btn btn-teal btn-sm" type="submit">Mark dispatched</button>
                    </form>
                  </td>
                </tr>
              ))}
              {readySalesOrders.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>No orders are awaiting dispatch.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2 packaging-overview">
        <div className="card">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">Production Work Dispatched Today</div>
              <div className="section-sub">Completed operator jobs dispatched by packaging</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Job</th><th>Product</th><th>Operator</th><th>Output</th></tr>
              </thead>
              <tbody>
                {dispatchedProductionWork.map((work) => {
                  const lastLog = work.StageLog[0]
                  const piecesOut = lastLog?.piecesOut ?? work.actualPieces ?? work.expectedPieces ?? work.quantity
                  const kgOut = lastLog?.kgOut == null
                    ? work.actualWeightOut == null ? Number(work.targetKg) : Number(work.actualWeightOut)
                    : Number(lastLog.kgOut)

                  return (
                    <tr key={work.id}>
                      <td style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{work.orderNumber}</td>
                      <td>{work.design?.name ?? work.productName ?? 'Direct order'}</td>
                      <td>{lastLog?.User?.name ?? lastLog?.User?.email ?? 'Unknown'}</td>
                      <td><span className="job-kg">{piecesOut.toLocaleString()} pcs/sets · {kgOut.toFixed(1)} kg</span></td>
                    </tr>
                  )
                })}
                {dispatchedProductionWork.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>No completed production work has been dispatched today.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">Sales Orders Shipped Today</div>
              <div className="section-sub">Sales orders marked dispatched by packaging</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Quantity</th><th>PCS/Sets</th><th>Value</th></tr>
              </thead>
              <tbody>
                {shippedSalesOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{order.id}</td>
                    <td>{order.customerName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{order.SaleItem.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{getPiecesSets(order.SaleItem).toLocaleString()}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>KES {Number(order.totalAmount).toLocaleString()}</td>
                  </tr>
                ))}
                {shippedSalesOrders.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>No sales orders have been shipped today.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
