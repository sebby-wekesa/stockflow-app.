import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function ImportHistoryPage() {
  const batches = await prisma.importBatch.findMany({
    include: { User: { select: { name: true } } },
    orderBy: { created_at: 'desc' },
  })

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-head text-2xl font-bold">Import History</h1>
          <p className="text-muted text-sm mt-1">
            View all completed imports
          </p>
        </div>
        <Link href="/import" className="btn btn-primary">
          New Import
        </Link>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">File</th>
                <th className="text-left p-4">Type</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Rows</th>
                <th className="text-left p-4">Uploaded by</th>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b hover:bg-surface2">
                  <td className="p-4">
                    <div className="font-medium">{batch.file_name}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted">{batch.sheet_type}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      batch.status === 'imported'
                        ? 'bg-green-500/10 text-green-600'
                        : batch.status === 'failed'
                        ? 'bg-red-500/10 text-red-600'
                        : 'bg-orange-500/10 text-orange-600'
                    }`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{batch.row_count}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted">{batch.User.name}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted">
                      {new Date(batch.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/import/${batch.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {batches.length === 0 && (
          <div className="text-center py-8 text-muted">
            No imports found. <Link href="/import" className="text-blue-600 hover:underline">Start your first import</Link>
          </div>
        )}
      </div>
    </div>
  )
}