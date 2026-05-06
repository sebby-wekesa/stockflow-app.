import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { JOB_STATUS_BADGE_CLASS, JOB_STATUS_LABELS } from '@/lib/production'
import type { JobCardStatus } from '@prisma/client'

const PAGE_SIZE = 50

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string }
}) {
  const status = searchParams.status as JobCardStatus | undefined
  const page = Math.max(1, Number(searchParams.page ?? 1))

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const [jobs, total, statusCounts] = await Promise.all([
    prisma.jobCard.findMany({
      where,
      orderBy: { opened_date: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        product: { select: { product_code: true, canonical_name: true, category: true } },
        created_by_user: { select: { full_name: true } },
        stages: { select: { stage_number: true, completed_at: true } },
      },
    }),
    prisma.jobCard.count({ where }),
    prisma.jobCard.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const countMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]))

  function buildHref(overrides: { status?: string; page?: number }) {
    const params = new URLSearchParams()
    const _status = overrides.status ?? status
    const _page = overrides.page ?? page
    if (_status) params.set('status', _status)
    if (_page > 1) params.set('page', String(_page))
    const qs = params.toString()
    return qs ? `/production?${qs}` : '/production'
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-head text-2xl font-bold">Production</h1>
          <p className="text-muted text-sm mt-1">
            Job cards for spring and U-bolt manufacture
          </p>
        </div>
        <Link href="/production/new" className="btn btn-primary">
          + New job card
        </Link>
      </div>

      {/* STATUS PILLS */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Link
          href={buildHref({ status: '', page: 1 })}
          className={`px-3 py-1.5 rounded-full text-xs border ${
            !status
              ? 'bg-accent border-accent text-bg font-semibold'
              : 'bg-surface border-border text-muted hover:border-accent hover:text-text'
          }`}
        >
          All · {Object.values(countMap).reduce((s, c) => s + c, 0)}
        </Link>
        {(['open', 'in_progress', 'complete', 'cancelled'] as const).map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s, page: 1 })}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              status === s
                ? 'bg-accent border-accent text-bg font-semibold'
                : 'bg-surface border-border text-muted hover:border-accent hover:text-text'
            }`}
          >
            {JOB_STATUS_LABELS[s]} {countMap[s] ? `· ${countMap[s]}` : ''}
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
                <th className="px-4 py-3 font-medium">Job #</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium text-right">Ordered</th>
                <th className="px-4 py-3 font-medium text-right">Produced</th>
                <th className="px-4 py-3 font-medium text-right">Progress</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Opened</th>
                <th className="px-4 py-3 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted text-sm">
                    {status ? (
                      <>
                        No {status.replace('_', ' ')} jobs.{' '}
                        <Link href="/production" className="text-accent">Clear filter</Link>
                      </>
                    ) : (
                      <>No job cards yet. <Link href="/production/new" className="text-accent">Create the first</Link>.</>
                    )}
                  </td>
                </tr>
              ) : (
                jobs.map((j) => {
                  const completed = j.stages.filter((s) => s.completed_at).length
                  const total = j.stages.length
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                  return (
                    <tr key={j.id} className="border-b border-border last:border-b-0 hover:bg-surface2">
                      <td className="px-4 py-3">
                        <Link href={`/production/${j.id}`} className="font-mono text-accent hover:underline">
                          JC-{j.job_card_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-muted">{j.product.product_code}</div>
                        <div className="text-xs truncate max-w-xs">{j.product.canonical_name}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{j.qty_ordered}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={j.qty_produced > 0 ? 'text-teal' : 'text-muted'}>
                          {j.qty_produced}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs text-muted">{completed}/{total} stages</div>
                        <div className="h-1 bg-surface2 rounded-full overflow-hidden mt-1 w-20 ml-auto">
                          <div
                            className="h-full bg-teal"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${JOB_STATUS_BADGE_CLASS[j.status]}`}>
                          {JOB_STATUS_LABELS[j.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {new Date(j.opened_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{j.created_by_user.full_name}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
            <div className="text-muted">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </div>
            <div className="flex gap-2">
              {page > 1 && <Link href={buildHref({ page: page - 1 })} className="btn btn-ghost btn-sm">← Previous</Link>}
              {page < totalPages && <Link href={buildHref({ page: page + 1 })} className="btn btn-ghost btn-sm">Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
