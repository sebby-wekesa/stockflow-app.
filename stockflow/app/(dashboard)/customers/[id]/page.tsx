import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { formatKES } from '@/lib/branches'
import { EditCustomerButton } from '../_components/EditCustomerButton'

interface CustomerPageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({ params }: CustomerPageProps) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  const { id } = await params

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      SaleOrder: {
        where: { status: { in: ['CONFIRMED', 'READY_FOR_DISPATCH', 'SHIPPED'] } },
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
      <div className="section-header mb-16">
        <div>
          <Link href="/customers" className="text-xs text-muted hover:text-text">
            ← Back to customers
          </Link>
          <div className="section-title mt-2">{customer.name}</div>
          <div className="section-sub">
            {customer.code} · Customer since {customer.createdAt.toLocaleDateString()}
          </div>
        </div>
        <EditCustomerButton customer={customer} />
      </div>

      {/* CUSTOMER INFO CARDS */}
      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-label">Total orders</div>
          <div className="stat-value">{totalOrders}</div>
          <div className="stat-sub">Confirmed and shipped</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Total spent</div>
          <div className="stat-value">{formatKES(totalSpent)}</div>
          <div className="stat-sub">Lifetime customer value</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Average order</div>
          <div className="stat-value">{totalOrders > 0 ? formatKES(totalSpent / totalOrders) : '—'}</div>
          <div className="stat-sub">Average order value</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Last order</div>
          <div className="stat-value">{lastOrderDate ? lastOrderDate.toLocaleDateString() : 'Never'}</div>
          <div className="stat-sub">Most recent purchase</div>
        </div>
      </div>

      {/* CONTACT INFO */}
      <div className="card p-6 mb-8">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Contact information</div>
            <div className="section-sub">Customer communication and billing details</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="form-label">Contact person</div>
            <div className="mt-1">{customer.contactName || 'Not provided'}</div>
          </div>
          <div>
            <div className="form-label">Phone</div>
            <div className="mt-1">{customer.phone || 'Not provided'}</div>
          </div>
          <div>
            <div className="form-label">Email</div>
            <div className="mt-1">{customer.email || 'Not provided'}</div>
          </div>
          <div>
            <div className="form-label">Tax ID</div>
            <div className="mt-1">{customer.taxId || 'Not provided'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="form-label">Address</div>
            <div className="mt-1">{customer.address || 'Not provided'}</div>
          </div>
        </div>
      </div>

      {/* PURCHASE HISTORY */}
      <div className="card">
        <div className="section-header mb-16">
          <div>
          <div className="section-title">Purchase history</div>
          <div className="section-sub">
            All completed orders from this customer
          </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {customer.SaleOrder.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    No orders found for this customer.
                  </td>
                </tr>
              ) : (
                customer.SaleOrder.map((order) => {
                  const orderTotal = order.SaleItem.reduce((sum, item) => sum + Number(item.totalPrice), 0)
                  return (
                    <tr key={order.id}>
                      <td>
                        <Link
                          href={`/sales/${order.id}`}
                          className="font-mono text-accent hover:underline"
                        >
                          {order.id}
                        </Link>
                      </td>
                      <td>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td><span className="badge badge-teal">{order.status}</span></td>
                      <td>
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
                      <td className="font-mono">
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
