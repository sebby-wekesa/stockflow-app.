import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function ImportHistoryPage() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
    include: {
      created_by_user: { select: { full_name: true } },
    },
  })

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/import" className="text-sm text-muted hover:text-text">
            ← Back to import centre
          </Link>
          <h1 className="font-head text-2xl font-bold mt-2">Import history</h1>
          <p className="text-muted text-sm mt-1">
            Every Excel import is logged with a full audit trail.
          </p>
        </div>
        <Link href="/import" className="btn btn-primary">
          + New import
        </Link>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Rows</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    No imports yet.{' '}
                    <Link href="/import" className="text-accent hover:underline">
                      Start your first
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="border-b border-border hover:bg-surface2">
                    <td className="px-4 py-3">
                      <Link
                        href={`/import/${b.id}`}
                        className="font-mono text-xs text-accent hover:underline"
                      >
                        {b.id.slice(-8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-4 py-3 truncate max-w-xs">{b.file_name}</td>
                    <td className="px-4 py-3 text-xs text-muted">{b.sheet_type}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple/15 text-purple">
                        {b.import_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{b.row_count}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          b.status === 'imported'
                            ? 'bg-teal/15 text-teal'
                            : b.status === 'failed'
                            ? 'bg-red/15 text-red'
                            : 'bg-accent/15 text-accent'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {b.created_by_user.full_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
