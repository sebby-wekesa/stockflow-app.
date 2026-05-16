import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { ImportBatch } from '@prisma/client'

interface SuccessViewProps {
  batch: ImportBatch
}

export async function SuccessView({ batch }: SuccessViewProps) {
  const rows = await prisma.importRow.findMany({
    where: { batch_id: batch.id },
  })

  const written = rows.filter(r => r.resolved_product).length
  const skipped = rows.filter(r => !r.resolved_product && !r.errors).length
  const errors = rows.filter(r => r.errors).length

  return (
    <div className="card p-8 text-center">
      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="font-head text-2xl font-bold mb-2">Import Complete!</h2>
      <p className="text-muted mb-6">
        Your data has been successfully imported into the system.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-surface2 rounded-md">
          <div className="text-xl font-bold text-green-600">{written}</div>
          <div className="text-sm text-muted">Written</div>
        </div>
        <div className="p-4 bg-surface2 rounded-md">
          <div className="text-xl font-bold text-orange-600">{skipped}</div>
          <div className="text-sm text-muted">Skipped</div>
        </div>
        <div className="p-4 bg-surface2 rounded-md">
          <div className="text-xl font-bold text-red-600">{errors}</div>
          <div className="text-sm text-muted">Errors</div>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <Link href="/products" className="btn btn-primary">
          View Products
        </Link>
        <Link href="/sales-orders" className="btn btn-ghost">
          View Sales Orders
        </Link>
        <Link href="/import" className="btn btn-ghost">
          New Import
        </Link>
      </div>
    </div>
  )
}