import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function ImportDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const importJob = await prisma.importJob.findUnique({
    where: { id: params.id },
    include: {
      conflicts: true,
      movements: {
        take: 10,
        include: { product: true },
      },
    },
  })

  if (!importJob) notFound()

  return (
    <div>
      <div className="mb-6">
        <Link href="/import/history" className="text-sm text-muted hover:text-text">
          ← Back to import history
        </Link>
        <h1 className="font-head text-2xl font-bold mt-2">Import details</h1>
        <p className="text-muted text-sm mt-1">
          {importJob.filename} · {importJob.status}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Total rows</div>
          <div className="font-head text-2xl font-bold">{importJob.total_rows}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Processed</div>
          <div className="font-head text-2xl font-bold">{importJob.processed_rows}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Conflicts</div>
          <div className="font-head text-2xl font-bold">{importJob.conflicts.length}</div>
        </div>
      </div>

      {importJob.conflicts.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-head font-bold mb-4">Conflicts</h2>
          <div className="space-y-3">
            {importJob.conflicts.map((conflict) => (
              <div key={conflict.id} className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                <div className="text-sm font-medium text-red-400">{conflict.raw_product_name}</div>
                <div className="text-xs text-muted mt-1">{conflict.error_message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {importJob.movements.length > 0 && (
        <div className="card p-6">
          <h2 className="font-head font-bold mb-4">Recent movements</h2>
          <div className="space-y-2">
            {importJob.movements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <div className="text-sm font-medium">{movement.product?.product_code}</div>
                  <div className="text-xs text-muted">{movement.qty} units</div>
                </div>
                <div className="text-xs text-muted">{movement.created_at.toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}