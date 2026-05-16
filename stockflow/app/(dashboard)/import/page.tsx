import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { QuickImportForm } from './quick-import-form'

export default async function ImportCentrePage() {
  // Recent batches across both flows
  const recentBatches = await prisma.importBatch.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
    include: { User: { select: { name: true } } },
  })

  // In-progress batches use the generic /import/[id] flow
  const inProgress = recentBatches.filter(
    (b) => b.status !== 'imported' && b.status !== 'failed' && b.status !== 'preview'
  )
  const specializedPreviews = recentBatches.filter((b) => b.status === 'preview')

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-head text-2xl font-bold">Import centre</h1>
          <p className="text-muted text-sm mt-1">
            Upload Excel files. Aliases auto-resolve product names against the master.
          </p>
        </div>
        <Link href="/import/history" className="btn btn-ghost">
          History
        </Link>
      </div>

      {/* PENDING SPECIALIZED PREVIEWS */}
      {specializedPreviews.length > 0 && (
        <div className="card p-4 mb-6 border-accent/30">
          <div className="font-head font-bold text-sm mb-3 text-accent">
            Awaiting commit
          </div>
          <div className="space-y-2">
            {specializedPreviews.map((b) => (
              <Link
                key={b.id}
                href={`/import/specialized/${b.id}`}
                className="flex items-center justify-between p-3 bg-surface2 rounded-md hover:bg-surface transition-colors"
              >
                <div>
                  <div className="text-sm font-medium">{b.file_name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {b.row_count} rows · {b.sheet_type} · {b.User.name} ·{' '}
                    {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                  Preview ready
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* IN-PROGRESS GENERIC IMPORTS */}
      {inProgress.length > 0 && (
        <div className="card p-4 mb-6 border-purple/30">
          <div className="font-head font-bold text-sm mb-3 text-purple">
            In-progress imports
          </div>
          <div className="space-y-2">
            {inProgress.map((b) => (
              <Link
                key={b.id}
                href={`/import/${b.id}`}
                className="flex items-center justify-between p-3 bg-surface2 rounded-md hover:bg-surface transition-colors"
              >
                <div>
                  <div className="text-sm font-medium">{b.file_name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {b.row_count} rows · {b.sheet_type} · {b.User.name} ·{' '}
                    {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple/15 text-purple capitalize">
                  {b.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* QUICK IMPORT */}
      <div className="mb-2">
        <h2 className="font-head font-bold text-lg">Import a Springtech file</h2>
        <p className="text-muted text-sm">
          Handles the QuickBooks sales export, the Springs/U-bolt master sheets, and the
          branch consumables stock files automatically.
        </p>
      </div>

      <QuickImportForm />
    </div>
  )
}