import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  purchase_receipt: { label: 'Purchase in', color: 'text-teal' },
  production_output: { label: 'Production', color: 'text-teal' },
  branch_transfer_out: { label: 'Transfer out', color: 'text-purple' },
  branch_transfer_in: { label: 'Transfer in', color: 'text-purple' },
  sales_out: { label: 'Sale', color: 'text-red' },
  adjustment_in: { label: 'Adjust +', color: 'text-accent' },
  adjustment_out: { label: 'Adjust −', color: 'text-accent' },
  return_in: { label: 'Return', color: 'text-teal' },
  scrap_out: { label: 'Scrap', color: 'text-red' },
}

export async function MovementHistory({
  productId,
  branch,
  limit = 20,
}: {
  productId: string
  branch?: string
  limit?: number
}) {
  const where: any = { productId }
  if (branch) where.branch = branch

  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { name: true } },
    },
  })

  if (movements.length === 0) {
    return (
      <div className="card p-6">
        <div className="font-head font-bold text-sm mb-2">Movement history</div>
        <p className="text-xs text-muted">
          No stock movements yet. Movements appear here when the product is sold, transferred,
          imported, or adjusted.
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="font-head font-bold text-sm">Movement history</div>
        <p className="text-xs text-muted mt-0.5">
          {branch ? `${branch} only · ` : ''}most recent {movements.length} movements
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Branch</th>
              <th className="px-4 py-2 font-medium text-right">Qty</th>
              <th className="px-4 py-2 font-medium">Reference</th>
              <th className="px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => {
              const meta = MOVEMENT_LABELS[m.type] ?? {
                label: m.type,
                color: 'text-muted',
              }
              return (
                <tr key={m.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">
                    {m.createdAt.toLocaleDateString()}
                  </td>
                  <td className={`px-4 py-2 text-xs font-medium ${meta.color}`}>
                    {meta.label}
                  </td>
                  <td className="px-4 py-2 text-xs capitalize">{m.branch}</td>
                  <td
                    className={`px-4 py-2 text-right font-mono text-sm ${
                      m.qty > 0 ? 'text-teal' : 'text-red'
                    }`}
                  >
                    {m.qty > 0 ? '+' : ''}
                    {m.qty}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-muted">
                    {m.reference ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted truncate max-w-xs">
                    {m.notes ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}