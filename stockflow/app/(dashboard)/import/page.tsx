import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { QuickImportForm } from './quick-import-form'

export default async function ImportCentrePage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const db = getTenantPrisma(user.organizationId)

  // Recent batches across both flows (auto-scoped to org via tenant prisma)
  const recentBatches = await db.importBatch.findMany({
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
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Import Centre</div>
          <div className="section-sub">
            Upload Excel files. Aliases auto-resolve product names against the master.
          </div>
        </div>
        <Link href="/import/history" className="btn btn-ghost">
          History
        </Link>
      </div>

      {/* PENDING SPECIALIZED PREVIEWS */}
      {specializedPreviews.length > 0 && (
        <div className="card mb-16">
          <div className="section-header mb-6">
            <div className="section-title">Awaiting Commit</div>
          </div>
          <div className="space-y-3">
            {specializedPreviews.map((b) => (
              <Link
                key={b.id}
                href={`/import/specialized/${b.id}`}
                className="flex items-center justify-between p-4 bg-surface2 rounded-lg hover:bg-surface transition-colors border border-border"
              >
                <div>
                  <div className="font-medium">{b.file_name}</div>
                  <div className="text-sm text-muted mt-1">
                    {b.row_count} rows · {b.sheet_type} · {b.User.name} ·{' '}
                    {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="badge badge-amber">Preview ready</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* IN-PROGRESS GENERIC IMPORTS */}
      {inProgress.length > 0 && (
        <div className="card mb-16">
          <div className="section-header mb-6">
            <div className="section-title">In Progress</div>
          </div>
          <div className="space-y-3">
            {inProgress.map((b) => (
              <Link
                key={b.id}
                href={`/import/${b.id}`}
                className="flex items-center justify-between p-4 bg-surface2 rounded-lg hover:bg-surface transition-colors border border-border"
              >
                <div>
                  <div className="font-medium">{b.file_name}</div>
                  <div className="text-sm text-muted mt-1">
                    {b.row_count} rows · {b.sheet_type} · {b.User.name} ·{' '}
                    {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="badge badge-purple capitalize">{b.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* IMPORT FORMS */}
      <div className="card">
        <div className="section-header mb-8">
          <div className="section-title">Import Files</div>
          <div className="section-sub">
            Handles QuickBooks sales, Springs/U-bolt master sheets, and branch consumables stock.
          </div>
        </div>

        <div className="space-y-12">
          <div>
            <div className="font-medium mb-4 text-sm text-muted">QUICK IMPORT</div>
            <QuickImportForm />
          </div>
        </div>
      </div>
    </div>
  )
}
