import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getBatchConflicts } from '@/lib/import/conflict-resolver'
import { Stepper } from './_components/stepper'
import { MappingStep } from './_components/mapping-step'
import { MatchResultsStep } from './_components/match-results-step'
import { ConflictsStep } from './_components/conflicts-step'
import { CommitStep } from './_components/commit-step'
import { ImportedView } from './_components/imported-view'

export default async function ImportWorkflowPage({
  params,
}: {
  params: { id: string }
}) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: params.id },
    include: {
      created_by_user: { select: { full_name: true } },
    },
  })

  if (!batch) notFound()

  // Fetch step-relevant data
  const [conflictRows, sampleRow, statusCounts] = await Promise.all([
    batch.status === 'preview' || batch.status === 'approved'
      ? getBatchConflicts(batch.id)
      : Promise.resolve([]),
    prisma.importRow.findFirst({
      where: { import_batch_id: batch.id },
      orderBy: { row_number: 'asc' },
    }),
    prisma.importRow.groupBy({
      by: ['status'],
      where: { import_batch_id: batch.id },
      _count: { _all: true },
    }),
  ])

  const statusMap: Record<string, number> = {}
  for (const c of statusCounts) statusMap[c.status] = c._count._all

  // For commit preview, also load sample resolved rows + branch breakdown
  let commitPreview: any = null
  if (batch.status === 'preview' || batch.status === 'approved') {
    const branchBreakdown = await prisma.importRow.groupBy({
      by: ['branch'],
      where: { import_batch_id: batch.id, status: 'ok' },
      _count: { _all: true },
      _sum: { qty: true },
    })
    commitPreview = { branchBreakdown }
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link href="/import" className="text-sm text-muted hover:text-text">
          ← Back to import centre
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="font-head text-2xl font-bold">{batch.file_name}</h1>
            <p className="text-muted text-sm mt-1">
              {batch.row_count} rows · {batch.sheet_type} · {batch.import_mode} mode · uploaded
              by {batch.created_by_user.full_name}
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-purple/15 text-purple capitalize">
            {batch.status}
          </span>
        </div>
      </div>

      <Stepper status={batch.status} />

      {/* Render the right step UI based on status */}
      {batch.status === 'mapping' && sampleRow && (
        <MappingStep
          batchId={batch.id}
          sheetType={batch.sheet_type}
          mappingConfig={batch.mapping_config as any}
          sampleData={sampleRow.raw_data as any}
        />
      )}

      {batch.status === 'validating' && (
        <div className="card p-8 text-center">
          <div className="font-head font-bold mb-2">Matching products...</div>
          <p className="text-muted text-sm">
            Resolving raw product names against the canonical master.
          </p>
        </div>
      )}

      {batch.status === 'preview' && (
        <>
          <MatchResultsStep
            batchId={batch.id}
            statusCounts={statusMap}
            totalRows={batch.row_count}
          />
          <ConflictsStep
            batchId={batch.id}
            conflicts={conflictRows}
          />
          <CommitStep
            batchId={batch.id}
            statusCounts={statusMap}
            conflictsRemaining={conflictRows.length}
            sheetType={batch.sheet_type}
            importMode={batch.import_mode}
            branchBreakdown={commitPreview?.branchBreakdown ?? []}
          />
        </>
      )}

      {batch.status === 'imported' && (
        <ImportedView
          batchId={batch.id}
          okCount={batch.ok_count}
          skippedCount={batch.skipped_count}
          errorCount={batch.error_count}
          importedAt={batch.imported_at}
        />
      )}

      {batch.status === 'failed' && (
        <div className="card p-6 border-red/30">
          <div className="font-head font-bold text-red mb-2">Import failed</div>
          <p className="text-sm text-muted mb-3">
            One or more rows could not be written. The batch has been marked as failed and no
            further changes are possible.
          </p>
          {batch.error_summary && (
            <pre className="bg-surface2 p-3 rounded-md text-xs font-mono text-muted whitespace-pre-wrap">
              {batch.error_summary}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
