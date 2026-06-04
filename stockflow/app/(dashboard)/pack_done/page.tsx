import Link from 'next/link'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function PackDonePage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const orders = await db.saleOrder.findMany({
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

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Fulfilled Today</div>
          <div className="section-sub">{orders.length} shipped orders from the database</div>
        </div>
        <Link href="/packaging" className="btn btn-ghost">Packaging queue</Link>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Items</th><th>Quantity</th><th>Value</th><th>Fulfilled</th></tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/sales/${order.id}`} style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{order.id}</Link></td>
                  <td>{order.customerName}</td>
                  <td>{order.SaleItem.map((item) => item.FinishedGoods.design.name).join(', ')}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{order.SaleItem.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>KES {Number(order.totalAmount).toLocaleString()}</td>
                  <td>{order.updatedAt.toLocaleString()}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>No orders have been fulfilled today.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
