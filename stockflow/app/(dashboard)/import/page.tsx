import Link from 'next/link'
import { UploadForm } from './_components/upload-form'

export default async function ImportCentrePage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-head text-2xl font-bold">Import centre</h1>
          <p className="text-muted text-sm mt-1">
            Upload Excel files. Aliases auto-resolve product names.
          </p>
        </div>
        <Link href="/import/history" className="btn btn-ghost">
          History
        </Link>
      </div>

      <div className="card p-4 mb-6 border-yellow/30">
        <div className="font-head font-bold text-sm mb-2 text-yellow">
          Import status
        </div>
        <p className="text-sm text-muted">
          The legacy import pipeline depends on tables that are not present in the current Prisma schema.
          Upload and mapping flows are temporarily disabled until the import schema is restored.
        </p>
      </div>

      <UploadForm />
    </div>
  )
}