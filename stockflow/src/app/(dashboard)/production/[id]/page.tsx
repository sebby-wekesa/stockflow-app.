import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  JOB_STATUS_BADGE_CLASS,
  JOB_STATUS_LABELS,
  getStagesForCategory,
  formatKg,
} from '@/lib/production'
import { StageList } from '../_components/stage-list'
import { JobActions } from '../_components/job-actions'
import type { ProductCategory } from '@prisma/client'

export default async function JobCardDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const job = await prisma.jobCard.findUnique({
    where: { id: params.id },
    include: {
      product: true,
      stages: { orderBy: { stage_number: 'asc' } },
      raw_materials: {
        include: {
          raw_material: true,
        },
      },
      created_by_user: { select: { full_name: true } },
    },
  })

  if (!job) notFound()

  const stageDefs = getStagesForCategory(job.product.category as ProductCategory)
  const completed = job.stages.filter((s) => s.completed_at).length
  const totalStages = job.stages.length
  const totalRMKg = job.raw_materials.reduce((sum, r) => sum + Number(r.qty_kg), 0)

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/production" className="text-sm text-muted hover:text-text">
            ← Back to production
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="font-head text-2xl font-bold font-mono">JC-{job.job_card_number}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${JOB_STATUS_BADGE_CLASS[job.status]}`}>
              {JOB_STATUS_LABELS[job.status]}
            </span>
          </div>
          <p className="text-muted text-sm mt-1">
            <Link href={`/products/${job.product.id}`} className="hover:underline">
              {job.product.product_code}
            </Link>{' '}
            · {job.product.canonical_name}
          </p>
        </div>

        <JobActions jobId={job.id} status={job.status} jobNumber={job.job_card_number} />
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Quantity ordered</div>
          <div className="font-head text-2xl font-bold font-mono">{job.qty_ordered}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Quantity produced</div>
          <div className={`font-head text-2xl font-bold font-mono ${job.qty_produced > 0 ? 'text-teal' : 'text-muted'}`}>
            {job.qty_produced}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Stages complete</div>
          <div className="font-head text-2xl font-bold font-mono">
            {completed}/{totalStages}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Material consumed</div>
          <div className="font-head text-2xl font-bold font-mono">
            {totalRMKg > 0 ? formatKg(totalRMKg) : '—'}
          </div>
        </div>
      </div>

      {/* RAW MATERIALS ISSUED */}
      {job.raw_materials.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="font-head font-bold text-sm mb-3">Raw materials issued</div>
          <div className="space-y-2">
            {job.raw_materials.map((rm) => (
              <div key={rm.id} className="flex items-center justify-between bg-surface2 rounded-md p-3">
                <div>
                  <Link
                    href={`/raw-materials/${rm.raw_material_id}`}
                    className="font-mono text-sm text-accent hover:underline"
                  >
                    {rm.raw_material.code}
                  </Link>
                  <div className="text-xs text-muted">{rm.raw_material.label}</div>
                  <div className="text-xs text-muted mt-1">
                    Issued {new Date(rm.issued_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-medium">{rm.qty_bars} bars</div>
                  <div className="font-mono text-xs text-muted">{formatKg(Number(rm.qty_kg))}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAGES */}
      <div className="mb-6">
        <h2 className="font-head font-bold text-lg mb-3">Production stages</h2>
        <StageList
          jobStatus={job.status}
          stages={job.stages}
          stageDefs={stageDefs}
        />
      </div>

      {/* NOTES */}
      {job.notes && (
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Notes</div>
          <div className="text-sm whitespace-pre-wrap">{job.notes}</div>
        </div>
      )}

      <div className="text-xs text-muted mt-6">
        Opened {new Date(job.opened_date).toLocaleString()} by {job.created_by_user.full_name}
        {job.completed_date && (
          <>
            {' · '}completed {new Date(job.completed_date).toLocaleString()}
          </>
        )}
      </div>
    </div>
  )
}
