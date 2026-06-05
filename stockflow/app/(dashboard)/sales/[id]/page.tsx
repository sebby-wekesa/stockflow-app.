import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { STATUS_BADGE_CLASS, STATUS_LABELS, formatKES } from '@/lib/sales-utils'
import { OrderActions } from '@/components/sales/OrderActions'
import { DraftSalesOrderEditor } from '@/components/sales/DraftSalesOrderEditor'

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  const order = await db.saleOrder.findUnique({
    where: { id },
    include: {
      SaleItem: {
        include: {
          FinishedGoods: { include: { design: true } },
        },
      },
      Customer: true,
      createdByUser: { select: { name: true } },
    },
  })

  if (!order) notFound()

  const total = order.SaleItem.reduce(
    (sum, item) => sum + Number(item.totalPrice),
    0
  )

  function getBillablePiecesSets(item: { unitPrice: unknown; totalPrice: unknown }) {
    const unitPrice = Number(item.unitPrice)
    if (unitPrice <= 0) return 0
    return Number(item.totalPrice) / unitPrice
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/sales" className="text-sm text-muted hover:text-text">
            ← Back to sales
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="font-head text-2xl font-bold font-mono">{order.id}</h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[order.status]}`}
            >
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-muted text-sm mt-1">
            {new Date(order.createdAt).toLocaleDateString()} ·
            recorded by {order.createdByUser?.name ?? 'system'}
          </p>
        </div>

        <OrderActions
          orderId={order.id}
          status={order.status}
          orderNumber={order.id}
        />
      </div>

      {order.status === 'PENDING' && (
        <DraftSalesOrderEditor
          orderId={order.id}
          customerName={order.customerName}
          lines={order.SaleItem.map((item) => {
            const unitPrice = Number(item.unitPrice)
            return {
              id: item.id,
              sku: item.FinishedGoods.sku,
              description: item.FinishedGoods.design?.name ?? item.FinishedGoods.sku,
              quantity: item.quantity,
              unitPrice,
              piecesSets: unitPrice > 0 ? Number(item.totalPrice) / unitPrice : 0,
            }
          })}
        />
      )}

      <div className="card p-8 mb-6 print:shadow-none">
        <div className="flex items-start justify-between mb-8 pb-6 border-b border-border">
          <div>
            <div className="font-head text-xl font-bold text-accent">Springtech (K) Ltd</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted mb-1">Invoice</div>
            <div className="font-mono text-lg font-bold">{order.id}</div>
            <div className="text-xs text-muted mt-1">
              {new Date(order.createdAt).toLocaleDateString('en-KE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Bill to</div>
          <div className="font-medium">
            {order.Customer ? (
              <Link href={`/customers/${order.Customer.id}`} className="hover:underline">
                {order.Customer.name}
              </Link>
            ) : (
              order.customerName
            )}
          </div>
          {order.Customer?.phone && (
            <div className="text-xs text-muted font-mono mt-0.5">{order.Customer.phone}</div>
          )}
        </div>

        <table className="w-full mb-6">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
              <th className="pb-2 font-medium">SKU</th>
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium text-right">Qty</th>
              <th className="pb-2 font-medium text-right">Sets/pcs</th>
              <th className="pb-2 font-medium text-right">Unit price</th>
              <th className="pb-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.SaleItem.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-b-0">
                <td className="py-3 font-mono text-xs text-accent align-top">
                  {item.FinishedGoods.sku}
                </td>
                <td className="py-3 text-sm align-top">
                  <div>{item.FinishedGoods.design?.name ?? item.FinishedGoods.sku}</div>
                </td>
                <td className="py-3 text-right font-mono text-sm align-top whitespace-nowrap">
                  {item.quantity}
                </td>
                <td className="py-3 text-right font-mono text-sm align-top whitespace-nowrap">
                  {getBillablePiecesSets(item).toLocaleString('en-KE', {
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3 text-right font-mono text-sm align-top whitespace-nowrap">
                  {formatKES(Number(item.unitPrice))}
                </td>
                <td className="py-3 text-right font-mono text-sm align-top whitespace-nowrap">
                  {formatKES(Number(item.totalPrice))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={5} className="pt-3 text-right font-medium">
                Total
              </td>
              <td className="pt-3 text-right font-mono font-bold text-lg">
                {formatKES(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
