import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { QuickImportForm } from './quick-import-form'
import { getImportBatchHref, isQuickImportSheetType } from './import-routing'
import { ALL_BRANCHES, normalizeBranchCode, type BranchCode } from '@/lib/branches'

interface ImportCentrePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ImportCentrePage({ searchParams }: ImportCentrePageProps) {
  const user = await getUser()
  if (!user) redirect('/login')

  const params = searchParams ? await searchParams : {}
  const showLegacyFlowNotice = params.legacyFlow === 'deprecated'

  const db = getTenantPrisma(user.organizationId)
  const isSuperUser = user.role === 'ADMIN' && user.branches.length === 0
  const recentBatchesPromise = db.importBatch.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
    include: { User: { select: { name: true } } },
  })
  const branchRecords = isSuperUser
    ? await db.branch.findMany({
        select: { name: true, code: true, location: true },
        orderBy: { name: 'asc' },
      })
    : []
  const branchOptions = ALL_BRANCHES.flatMap((code): Array<{ code: BranchCode; name: string }> => {
    const branch = branchRecords.find(
      (candidate) => normalizeBranchCode(candidate.code, candidate.name, candidate.location) === code
    )
    return branch ? [{ code, name: branch.name }] : []
  })
  const assignedBranchCode = normalizeBranchCode(user.branches[0]?.name)

  // Recent batches across both flows (auto-scoped to org via tenant prisma)
  const recentBatches = await recentBatchesPromise

  // Legacy in-progress batches cannot continue through the retired mapping flow.
  const inProgress = recentBatches.filter(
    (b) => !isQuickImportSheetType(b.sheet_type) && b.status !== 'imported' && b.status !== 'failed'
  )
  const specializedPreviews = recentBatches.filter(
    (b) => isQuickImportSheetType(b.sheet_type) && b.status === 'preview'
  )

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

      {showLegacyFlowNotice && (
        <div className="import-alert import-alert-error mb-16">
          The legacy column-mapping import flow has been retired. Start a new Quick Import for
          QuickBooks sales, springs or U-bolt masters, and consumables stock files.
        </div>
      )}

      {/* PENDING SPECIALIZED PREVIEWS */}
      {specializedPreviews.length > 0 && (
        <div className="card mb-16">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">Awaiting Commit</div>
              <div className="section-sub">Review parsed files before adding them to SpringTech(K)Ltd</div>
            </div>
            <span className="badge badge-amber">{specializedPreviews.length} pending</span>
          </div>
          <div className="import-batch-list">
            {specializedPreviews.map((b) => (
              <Link
                key={b.id}
                href={getImportBatchHref(b)}
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
              <div className="section-title">Legacy Imports</div>
              <div className="section-sub">
                These were created before Quick Import and must be re-uploaded with the new flow.
              </div>
            </div>
            <span className="badge badge-amber">{inProgress.length} needs re-upload</span>
          </div>
          <div className="import-batch-list">
            {inProgress.map((b) => (
              <Link
                key={b.id}
                href={getImportBatchHref(b)}
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
        <QuickImportForm
          assignedBranchName={user.branches[0]?.name ?? null}
          assignedBranchCode={assignedBranchCode}
          branchOptions={branchOptions}
          canChooseBranch={isSuperUser}
        />
      </div>
    </div>
  )
}
