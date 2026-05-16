import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CommitButton } from '../../commit-button'

const SHEET_TYPE_LABELS: Record<string, string> = {
  sales_quickbooks_v2: 'QuickBooks sales export',
  springs_master: 'Springs master list',
  ubolt_master: 'U-bolt master list',
  consumables_stock: 'Branch consumables stock',
}

export default async function SpecializedBatchPage({
  params,
}: {
  params: { id: string }
}) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: params.id },
    include: { created_by_user: { select: { full_name: true } } },
  })
  if (!batch) notFound()

  const config = batch.mapping_config as any
  const preview: any[] = config?.preview ?? []
  const sheetType = batch.sheet_type

  // Render different table columns based on sheet type
  const isProduct = sheetType === 'springs_master' || sheetType === 'ubolt_master'
  const isSales = sheetType === 'sales_quickbooks_v2'
  const isStock = sheetType === 'consumables_stock'

  const isImported = batch.status === 'imported'
  const isFailed = batch.status === 'failed'

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link href="/import" className="text-sm text-muted hover:text-text">
          ← Back to import centre
        </Link>
        <h1 className="font-head text-2xl font-bold mt-2">{batch.file_name}</h1>
        <p className="text-muted text-sm mt-1">
          {SHEET_TYPE_LABELS[sheetType] ?? sheetType} · {batch.row_count} rows parsed
          {batch.branch && ` · ${batch.branch}`}
        </p>
      </div>

      {/* STATUS BANNER */}
      {isImported && (
        <div className="card p-5 mb-6 border-teal/30 bg-teal/5">
          <div className="font-head font-bold text-teal mb-1">✓ Import complete</div>
          <div className="text-sm text-muted">
            {batch.ok_count} rows written · {batch.skipped_count} skipped · {batch.error_count}{' '}
            errors
          </div>
          {batch.error_summary && batch.error_count > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-muted cursor-pointer hover:text-text">
                View error log
              </summary>
              <pre className="mt-2 text-xs bg-bg p-3 rounded-md font-mono whitespace-pre-wrap text-red-400">
                {batch.error_summary}
              </pre>
            </details>
          )}
        </div>
      )}

      {isFailed && (
        <div className="card p-5 mb-6 border-red/30 bg-red/5">
          <div className="font-head font-bold text-red mb-1">Import failed</div>
          <div className="text-xs text-red-400 font-mono">{batch.error_summary}</div>
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Rows parsed</div>
          <div className="font-head text-2xl font-bold font-mono">{batch.row_count}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Status</div>
          <div className="font-head text-lg font-bold capitalize">{batch.status}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Uploaded by</div>
          <div className="font-head text-sm font-bold mt-1">
            {batch.created_by_user.full_name}
          </div>
        </div>
      </div>

      {/* PREVIEW TABLE */}
      {preview.length > 0 && (
        <div className="card mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="font-head font-bold text-sm">
              Sample rows ({preview.length} of {batch.row_count})
            </div>
            <p className="text-xs text-muted mt-1">
              First 10 rows from the file — verify the data looks right before committing.
            </p>
          </div>
          <div className="overflow-x-auto">
            {isSales && <SalesPreviewTable rows={preview} />}
            {isProduct && <ProductPreviewTable rows={preview} />}
            {isStock && <StockPreviewTable rows={preview} />}
          </div>
        </div>
      )}

      {/* COMMIT */}
      {!isImported && !isFailed && (
        <CommitButton
          batchId={batch.id}
          rowCount={batch.row_count}
          sheetType={sheetType}
        />
      )}

      {isImported && (
        <div className="flex gap-2">
          <Link href="/import" className="btn btn-ghost">
            Back to imports
          </Link>
          {(sheetType === 'springs_master' || sheetType === 'ubolt_master') && (
            <Link href="/products" className="btn btn-primary">
              View products →
            </Link>
          )}
          {sheetType === 'sales_quickbooks_v2' && (
            <Link href="/sales" className="btn btn-primary">
              View sales →
            </Link>
          )}
          {sheetType === 'consumables_stock' && (
            <Link href="/stock" className="btn btn-primary">
              View stock →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function SalesPreviewTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
          <th className="px-4 py-2 font-medium">Row</th>
          <th className="px-4 py-2 font-medium">Date</th>
          <th className="px-4 py-2 font-medium">Invoice</th>
          <th className="px-4 py-2 font-medium">Product (raw)</th>
          <th className="px-4 py-2 font-medium">Customer</th>
          <th className="px-4 py-2 font-medium">Branch</th>
          <th className="px-4 py-2 font-medium text-right">Qty</th>
          <th className="px-4 py-2 font-medium text-right">Price</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border last:border-b-0">
            <td className="px-4 py-2 text-xs text-muted font-mono">{r.source_row}</td>
            <td className="px-4 py-2 text-xs">
              {r.movement_date ? new Date(r.movement_date).toLocaleDateString() : '—'}
            </td>
            <td className="px-4 py-2 text-xs font-mono">{r.order_number ?? '—'}</td>
            <td className="px-4 py-2 text-xs font-mono truncate max-w-xs">
              {r.raw_product_name}
            </td>
            <td className="px-4 py-2 text-xs truncate max-w-[140px]">
              {r.customer_name ?? '—'}
            </td>
            <td className="px-4 py-2 text-xs capitalize">{r.branch ?? '—'}</td>
            <td className="px-4 py-2 text-right font-mono">{r.qty}</td>
            <td className="px-4 py-2 text-right font-mono">{r.unit_price ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ProductPreviewTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
          <th className="px-4 py-2 font-medium">Row</th>
          <th className="px-4 py-2 font-medium">Code</th>
          <th className="px-4 py-2 font-medium">Canonical name</th>
          <th className="px-4 py-2 font-medium">Make</th>
          <th className="px-4 py-2 font-medium">Position</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border last:border-b-0">
            <td className="px-4 py-2 text-xs text-muted font-mono">{r.source_row}</td>
            <td className="px-4 py-2 text-xs font-mono text-accent">{r.product_code}</td>
            <td className="px-4 py-2 text-xs truncate max-w-md">{r.canonical_name}</td>
            <td className="px-4 py-2 text-xs">{r.vehicle_make ?? '—'}</td>
            <td className="px-4 py-2 text-xs">
              {r.spring_position} {r.leaf_position && `· ${r.leaf_position}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StockPreviewTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
          <th className="px-4 py-2 font-medium">Row</th>
          <th className="px-4 py-2 font-medium">Date</th>
          <th className="px-4 py-2 font-medium">Product (raw)</th>
          <th className="px-4 py-2 font-medium">Branch</th>
          <th className="px-4 py-2 font-medium">Direction</th>
          <th className="px-4 py-2 font-medium text-right">Qty</th>
          <th className="px-4 py-2 font-medium">Ref</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border last:border-b-0">
            <td className="px-4 py-2 text-xs text-muted font-mono">{r.source_row}</td>
            <td className="px-4 py-2 text-xs">
              {r.movement_date ? new Date(r.movement_date).toLocaleDateString() : '—'}
            </td>
            <td className="px-4 py-2 text-xs font-mono truncate max-w-xs">
              {r.raw_product_name}
            </td>
            <td className="px-4 py-2 text-xs capitalize">{r.branch}</td>
            <td className="px-4 py-2">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  r.direction === 'in'
                    ? 'bg-teal/15 text-teal'
                    : 'bg-accent/15 text-accent'
                }`}
              >
                {r.direction.toUpperCase()}
              </span>
            </td>
            <td className="px-4 py-2 text-right font-mono">{r.qty}</td>
            <td className="px-4 py-2 text-xs text-muted">{r.reference ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}