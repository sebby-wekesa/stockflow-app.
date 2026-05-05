import Link from 'next/link'

export default function ImportBatchDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-3xl">
      <Link href="/import" className="text-sm text-muted hover:text-text">← Back to import</Link>
      <h1 className="font-head text-2xl font-bold mt-2">Import batch {params.id}</h1>
      <div className="card p-5 mt-4">
        <p className="text-sm text-muted">
          The phase 3 import workflow has been integrated as route scaffolding, but execution remains disabled
          because the current Prisma schema does not include the legacy import tables (`ImportBatch`, `ImportRow`, aliases).
        </p>
      </div>
    </div>
  )
}
