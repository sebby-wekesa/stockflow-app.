import Link from 'next/link'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { markOrderShipped } from '@/app/actions/packaging'

export const dynamic = 'force-dynamic'

export default async function PackDonePage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const orders = await db.saleOrder.findMany({
    where: {
      status: 'READY_FOR_DISPATCH',
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

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Ready for Dispatch</div>
          <div className="section-sub">{orders.length} packaged orders awaiting dispatch</div>
        </div>
        <Link href="/packaging" className="btn btn-ghost">Packaging queue</Link>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Items</th><th>Quantity</th><th>Value</th><th>Action</th></tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/sales/${order.id}`} style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{order.id}</Link></td>
                  <td>{order.customerName}</td>
                  <td>{order.SaleItem.map((item) => item.FinishedGoods.design.name).join(', ')}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{order.SaleItem.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>KES {Number(order.totalAmount).toLocaleString()}</td>
                  <td>
                    <form action={async () => { 'use server'; await markOrderShipped(order.id) }}>
                      <button className="btn btn-teal btn-sm" type="submit">Mark dispatched</button>
                    </form>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>No orders are awaiting dispatch.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
