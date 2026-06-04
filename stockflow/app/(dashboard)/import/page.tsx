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
            Upload and review sales, product master, and branch stock files.
          </div>
        </div>
        <Link href="/import/history" className="btn btn-ghost">
          Import history
        </Link>
      </div>

      {/* PENDING SPECIALIZED PREVIEWS */}
      {specializedPreviews.length > 0 && (
        <div className="card mb-16">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">Awaiting Commit</div>
              <div className="section-sub">Review parsed files before adding them to StockFlow</div>
            </div>
            <span className="badge badge-amber">{specializedPreviews.length} pending</span>
          </div>
          <div className="import-batch-list">
            {specializedPreviews.map((b) => (
              <Link
                key={b.id}
                href={`/import/specialized/${b.id}`}
                className="card-sm import-batch-row"
              >
                <div className="import-batch-copy">
                  <div className="import-batch-name">{b.file_name}</div>
                  <div className="section-sub">
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
          <div className="section-header mb-16">
            <div>
              <div className="section-title">In Progress</div>
              <div className="section-sub">Continue imports that still need attention</div>
            </div>
            <span className="badge badge-purple">{inProgress.length} active</span>
          </div>
          <div className="import-batch-list">
            {inProgress.map((b) => (
              <Link
                key={b.id}
                href={`/import/${b.id}`}
                className="card-sm import-batch-row"
              >
                <div className="import-batch-copy">
                  <div className="import-batch-name">{b.file_name}</div>
                  <div className="section-sub">
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
        <div className="section-header mb-16">
          <div>
            <div className="section-title">New Import</div>
            <div className="section-sub">
              Select the file type, confirm your branch, then upload an Excel or CSV file.
            </div>
          </div>
          <span className="badge badge-muted">Excel · CSV</span>
        </div>
        <QuickImportForm assignedBranchName={user.branches[0]?.name ?? null} />
      </div>
    </div>
  )
}
