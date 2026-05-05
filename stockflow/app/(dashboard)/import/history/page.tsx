import Link from 'next/link'

export default function ImportHistoryPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/import" className="text-sm text-muted hover:text-text">← Back to import</Link>
      <h1 className="font-head text-2xl font-bold mt-2">Import history</h1>
      <div className="card p-5 mt-4">
        <p className="text-sm text-muted">
          History view is staged from phase 3, but data-backed history is unavailable until import tables are
          reintroduced in Prisma schema and migrated.
        </p>
      </div>
    </div>
  )
}
