import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { ImportBatch } from '@prisma/client'
import { getUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { getSheetTypeLabel, isQuickImportSheetType } from '../import-routing'

interface PageProps {
  params: Promise<{ id: string }>
}

type BatchWithIncludes = ImportBatch & {
  User: { name: string | null } | null
}

export default async function ImportDetailPage({ params }: PageProps) {
  const { id } = await params

  const user = await getUser()
  if (!user) redirect('/login')

  const db = getTenantPrisma(user.organizationId)

  const batch = await db.importBatch.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      User: { select: { name: true } },
    },
  }) as BatchWithIncludes | null

  if (!batch) {
    notFound()
  }

  if (isQuickImportSheetType(batch.sheet_type)) {
    redirect(`/import/specialized/${batch.id}`)
  }

  return <LegacyImportNotice batch={batch} />
}

function LegacyImportNotice({ batch }: { batch: BatchWithIncludes }) {
  const isImported = batch.status === 'imported'
  const isFailed = batch.status === 'failed'

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/import" className="text-sm text-muted hover:text-text">
          ← Back to import centre
        </Link>
        <h1 className="font-head text-2xl font-bold mt-2">{batch.file_name}</h1>
        <p className="text-muted text-sm mt-1">
          {getSheetTypeLabel(batch.sheet_type)} · {batch.row_count} rows · uploaded by{' '}
          {batch.User?.name ?? 'Unknown'}
        </p>
      </div>

      <div className="card p-6">
        <div className="mb-4">
          <span
            className={`badge ${
              isImported ? 'badge-teal' : isFailed ? 'badge-red' : 'badge-amber'
            }`}
          >
            {isImported ? 'Imported' : isFailed ? 'Failed' : 'Legacy flow retired'}
          </span>
        </div>

        <h2 className="font-head text-xl font-bold mb-2">
          {isImported ? 'Legacy import record' : 'This import cannot be continued'}
        </h2>
        <p className="text-sm text-muted mb-5">
          {isImported
            ? 'This batch was completed with the old generic import workflow. It is kept here as a read-only history record.'
            : 'This batch was created by the retired generic column-mapping workflow. Re-upload the source file from the Import Centre using Quick Import so it can be parsed with the tenant-safe specialized import flow.'}
        </p>

        <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="card-sm p-3">
            <dt className="text-xs uppercase tracking-wider text-muted mb-1">Status</dt>
            <dd className="font-head font-bold capitalize">{batch.status}</dd>
          </div>
          <div className="card-sm p-3">
            <dt className="text-xs uppercase tracking-wider text-muted mb-1">Rows</dt>
            <dd className="font-head font-bold font-mono">{batch.row_count}</dd>
          </div>
          <div className="card-sm p-3">
            <dt className="text-xs uppercase tracking-wider text-muted mb-1">Uploaded</dt>
            <dd className="font-head font-bold text-sm">
              {new Date(batch.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>

        {batch.error_summary && (
          <pre className="mb-5 text-xs bg-bg p-3 rounded-md font-mono whitespace-pre-wrap text-red-400">
            {batch.error_summary}
          </pre>
        )}

        <div className="flex gap-2">
          <Link href="/import" className="btn btn-primary">
            New Quick Import
          </Link>
          <Link href="/import/history" className="btn btn-ghost">
            Import history
          </Link>
        </div>
      </div>
    </div>
  )
}
