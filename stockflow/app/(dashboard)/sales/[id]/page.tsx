import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { BRANCH_LABELS } from '@/lib/branches'
import { STATUS_BADGE_CLASS, STATUS_LABELS, formatKES } from '@/lib/sales'
import { OrderActions } from '../_components/order-actions'

export default async function SalesOrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.saleOrder.findUnique({
    where: { id: params.id },
    include: {
      lines: { include: { product: true }, orderBy: { createdAt: 'asc' } },
      salesRep: { select: { name: true, email: true } },
      customer: true,
    },
  })
  if (!order) notFound()

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/sales" className="text-sm text-muted hover:text-text">← Back to sales</Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="font-head text-2xl font-bold font-mono">{order.orderNumber ?? order.id.slice(0, 8)}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
          </div>
          <p className="text-muted text-sm mt-1">
            {BRANCH_LABELS[order.branch]} · {new Date(order.orderDate).toLocaleDateString()} · recorded by {order.salesRep.name ?? order.salesRep.email}
          </p>
        </div>
        <OrderActions orderId={order.id} status={order.status} orderNumber={order.orderNumber ?? order.id.slice(0, 8)} />
      </div>

      <div className="card p-6">
        <table className="w-full">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
              <th className="pb-2">Code</th><th className="pb-2">Description</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Unit</th><th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-border last:border-b-0">
                <td className="py-3 font-mono text-accent">{line.product.code}</td>
                <td className="py-3">{line.product.name}</td>
                <td className="py-3 text-right font-mono">{line.quantity}</td>
                <td className="py-3 text-right font-mono">{formatKES(line.unitPrice)}</td>
                <td className="py-3 text-right font-mono">{formatKES(line.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-right font-mono font-bold text-lg mt-4">{formatKES(order.totalAmount)}</div>
      </div>
    </div>
  )
}
