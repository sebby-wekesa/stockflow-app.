import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatKES } from '@/lib/branches'

interface CustomerPageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({ params }: CustomerPageProps) {
  const { id } = await params

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      SaleOrder: {
        where: { status: { in: ['CONFIRMED', 'SHIPPED'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          SaleItem: {
            include: {
              FinishedGoods: { select: { sku: true } }
            }
          }
        }
      }
    }
  })

  if (!customer) {
    notFound()
  }

  // Calculate customer statistics
  const totalOrders = customer.SaleOrder.length
  const totalSpent = customer.SaleOrder.reduce((sum, order) => {
    return sum + order.SaleItem.reduce((itemSum, item) => itemSum + Number(item.totalPrice), 0)
  }, 0)
  const lastOrderDate = customer.SaleOrder.length > 0
    ? new Date(Math.max(...customer.SaleOrder.map(order => new Date(order.createdAt).getTime())))
    : null

  return (
    <div>
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-muted hover:text-text">
          ← Back to customers
        </Link>
        <h1 className="font-head text-2xl font-bold mt-2">{customer.name}</h1>
        <div className="text-muted text-sm">
          Customer since {customer.createdAt.toLocaleDateString()}
        </div>
      </div>

      {/* CUSTOMER INFO CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-accent">{totalOrders}</div>
          <div className="text-sm text-muted">Total Orders</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-teal">{formatKES(totalSpent)}</div>
          <div className="text-sm text-muted">Total Spent</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-purple">
            {totalOrders > 0 ? formatKES(totalSpent / totalOrders) : '—'}
          </div>
          <div className="text-sm text-muted">Avg Order Value</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-orange">
            {lastOrderDate ? lastOrderDate.toLocaleDateString() : 'Never'}
          </div>
          <div className="text-sm text-muted">Last Order</div>
        </div>
      </div>

      {/* CONTACT INFO */}
      <div className="card p-6 mb-8">
        <h2 className="font-head font-bold text-lg mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm font-medium text-muted mb-1">Phone</div>
            <div className="text-lg">{customer.phone || 'Not provided'}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted mb-1">Email</div>
            <div className="text-lg">{customer.email || 'Not provided'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm font-medium text-muted mb-1">Address</div>
            <div className="text-lg">{customer.address || 'Not provided'}</div>
          </div>
        </div>
      </div>

      {/* PURCHASE HISTORY */}
      <div className="card">
        <div className="p-6 border-b border-border">
          <h2 className="font-head font-bold text-lg">Purchase History</h2>
          <p className="text-sm text-muted mt-1">
            All completed orders from this customer
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
                <th className="px-6 py-3 font-medium">Order #</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Branch</th>
                <th className="px-6 py-3 font-medium">Items</th>
                <th className="px-6 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {customer.SaleOrder.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted">
                    No orders found for this customer.
                  </td>
                </tr>
              ) : (
                customer.SaleOrder.map((order) => {
                  const orderTotal = order.SaleItem.reduce((sum, item) => sum + Number(item.totalPrice), 0)
                  return (
                    <tr key={order.id} className="border-b border-border last:border-b-0 hover:bg-surface2">
                      <td className="px-6 py-4">
                        <Link
                          href={`/sales/${order.id}`}
                          className="font-mono text-accent hover:underline"
                        >
                          {order.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 capitalize">{order.status.toLowerCase()}</td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          {order.SaleItem.slice(0, 2).map((item, index) => (
                            <div key={index} className="text-sm truncate">
                              {item.quantity} × {item.FinishedGoods?.sku ?? 'unknown'}
                            </div>
                          ))}
                          {order.SaleItem.length > 2 && (
                            <div className="text-xs text-muted">
                              +{order.SaleItem.length - 2} more items
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {formatKES(orderTotal)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}