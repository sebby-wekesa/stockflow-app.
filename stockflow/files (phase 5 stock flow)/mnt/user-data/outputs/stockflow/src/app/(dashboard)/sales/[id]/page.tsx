import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { BRANCH_LABELS } from '@/lib/branches'
import { STATUS_BADGE_CLASS, STATUS_LABELS, formatKES } from '@/lib/sales'
import { OrderActions } from '../_components/order-actions'

export default async function SalesOrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const order = await prisma.salesOrder.findUnique({
    where: { id: params.id },
    include: {
      lines: { include: { product: true }, orderBy: { created_at: 'asc' } },
      created_by_user: { select: { full_name: true } },
      customer: true,
    },
  })

  if (!order) notFound()

  const total = order.lines.reduce((sum, l) => sum + Number(l.total_amount), 0)

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/sales" className="text-sm text-muted hover:text-text">
            ← Back to sales
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="font-head text-2xl font-bold font-mono">{order.order_number}</h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[order.status]}`}
            >
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-muted text-sm mt-1">
            {BRANCH_LABELS[order.branch]} · {new Date(order.invoice_date).toLocaleDateString()} ·
            recorded by {order.created_by_user.full_name}
          </p>
        </div>

        <OrderActions
          orderId={order.id}
          status={order.status}
          orderNumber={order.order_number}
        />
      </div>

      {/* INVOICE */}
      <div className="card p-8 mb-6 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b border-border">
          <div>
            <div className="font-head text-xl font-bold text-accent">Springtech (K) Ltd</div>
            <div className="text-xs text-muted mt-0.5">{BRANCH_LABELS[order.branch]}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted mb-1">Invoice</div>
            <div className="font-mono text-lg font-bold">{order.order_number}</div>
            <div className="text-xs text-muted mt-1">
              {new Date(order.invoice_date).toLocaleDateString('en-KE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Bill to</div>
          <div className="font-medium">
            {order.customer ? (
              <Link href={`/customers/${order.customer.id}`} className="hover:underline">
                {order.customer.name}
              </Link>
            ) : (
              order.customer_name
            )}
          </div>
          {order.customer?.phone && (
            <div className="text-xs text-muted font-mono mt-0.5">{order.customer.phone}</div>
          )}
        </div>

        {/* Line items */}
        <table className="w-full mb-6">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
              <th className="pb-2 font-medium">Code</th>
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium text-right">Qty</th>
              <th className="pb-2 font-medium text-right">Unit price</th>
              <th className="pb-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-border last:border-b-0">
                <td className="py-3 font-mono text-xs text-accent align-top">
                  <Link href={`/products/${line.product_id}`} className="hover:underline">
                    {line.product.product_code}
                  </Link>
                </td>
                <td className="py-3 text-sm align-top">
                  <div>{line.product_name}</div>
                  {line.notes && (
                    <div className="text-xs text-muted mt-0.5">{line.notes}</div>
                  )}
                </td>
                <td className="py-3 text-right font-mono text-sm align-top whitespace-nowrap">
                  {line.qty} {line.uom}
                </td>
                <td className="py-3 text-right font-mono text-sm align-top whitespace-nowrap">
                  {formatKES(Number(line.unit_price))}
                </td>
                <td className="py-3 text-right font-mono text-sm align-top whitespace-nowrap">
                  {formatKES(Number(line.total_amount))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={4} className="pt-3 text-right font-medium">
                Total
              </td>
              <td className="pt-3 text-right font-mono font-bold text-lg">
                {formatKES(total)}
              </td>
            </tr>
          </tfoot>
        </table>

        {order.notes && (
          <div className="mt-6 pt-4 border-t border-border">
            <div className="text-xs uppercase tracking-wider text-muted mb-1">Notes</div>
            <div className="text-sm whitespace-pre-wrap">{order.notes}</div>
          </div>
        )}
      </div>
    </div>
  )
}
