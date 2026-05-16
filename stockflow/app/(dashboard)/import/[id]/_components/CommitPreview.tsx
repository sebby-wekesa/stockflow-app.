import { prisma } from '@/lib/prisma'
import type { ImportBatch } from '@prisma/client'

interface CommitPreviewProps {
  batch: ImportBatch
}

export async function CommitPreview({ batch }: CommitPreviewProps) {
  // Get summary stats
  const rows = await prisma.importRow.findMany({
    where: { batch_id: batch.id },
  })

  const willWrite = rows.filter(r => r.resolved_product).length
  const willSkip = rows.length - willWrite
  const errors = rows.filter(r => r.errors).length

  // Group by branch for impact breakdown
  const branchGroups = new Map<string, number>()
  for (const row of rows) {
    if (row.resolved_product && row.qty) {
      const branch = batch.target_branch || 'all'
      branchGroups.set(branch, (branchGroups.get(branch) || 0) + row.qty)
    }
  }

  return (
    <div className="card p-6">
      <h3 className="font-head text-lg font-bold mb-4">Commit Preview</h3>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-green-500/10 rounded-md">
          <div className="text-2xl font-bold text-green-600">{willWrite}</div>
          <div className="text-sm text-muted">Rows to write</div>
        </div>
        <div className="text-center p-4 bg-orange-500/10 rounded-md">
          <div className="text-2xl font-bold text-orange-600">{willSkip}</div>
          <div className="text-sm text-muted">Rows to skip</div>
        </div>
        <div className="text-center p-4 bg-red-500/10 rounded-md">
          <div className="text-2xl font-bold text-red-600">{errors}</div>
          <div className="text-sm text-muted">Errors</div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-medium mb-3">Impact by Branch</h4>
        <div className="space-y-2">
          {Array.from(branchGroups.entries()).map(([branch, qty]) => (
            <div key={branch} className="flex justify-between p-3 bg-surface2 rounded-md">
              <span className="capitalize">{branch}</span>
              <span>{qty} units</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue/10 border border-blue/30 p-4 rounded-md">
        <p className="text-sm">
          <strong>Mode:</strong> {batch.import_mode} · <strong>Target:</strong> {batch.target_branch || 'All branches'}
        </p>
        {batch.sheet_type === 'sales_quickbooks' && (
          <p className="text-sm mt-2 text-blue">
            Sales import: Will create SalesOrder records grouped by invoice number, plus stock movements.
          </p>
        )}
      </div>
    </div>
  )
}