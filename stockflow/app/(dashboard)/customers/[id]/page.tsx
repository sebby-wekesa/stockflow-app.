import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatKES, STATUS_BADGE_CLASS, STATUS_LABELS } from '@/lib/sales'
import { CustomerForm } from '../_components/customer-form'
import { updateCustomer } from '../actions'

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      saleOrders: {
        orderBy: { orderDate: 'desc' },
        take: 50,
      },
    },
  })
  if (!customer) notFound()

  const totalSpend = customer.saleOrders.reduce((sum, o) => sum + o.totalAmount, 0)
  const updateAction = updateCustomer.bind(null, customer.id)

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-muted hover:text-text">← Back to customers</Link>
        <h1 className="font-head text-2xl font-bold mt-2">{customer.name}</h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4"><div className="text-xs text-muted">Total orders</div><div className="font-head text-2xl font-bold">{customer.saleOrders.length}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Total spend</div><div className="font-head text-2xl font-bold font-mono">{formatKES(totalSpend)}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Last order</div><div className="font-head text-sm font-medium mt-1">{customer.saleOrders[0] ? new Date(customer.saleOrders[0].orderDate).toLocaleDateString() : '—'}</div></div>
      </div>

      {customer.saleOrders.length > 0 && (
        <div className="card mb-6">
          <div className="px-5 py-4 border-b border-border"><div className="font-head font-bold text-sm">Order history</div></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {customer.saleOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2"><Link href={`/sales/${order.id}`} className="font-mono text-accent hover:underline">{order.orderNumber ?? order.id.slice(0, 8)}</Link></td>
                    <td className="px-4 py-2 text-muted text-xs">{new Date(order.orderDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[order.status]}`}>{STATUS_LABELS[order.status]}</span></td>
                    <td className="px-4 py-2 text-right font-mono">{formatKES(order.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="font-head font-bold text-lg mb-3">Edit details</h2>
      <CustomerForm mode="edit" initial={{ name: customer.name, contactInfo: customer.contactInfo }} action={updateAction} />
    </div>
  )
}
