import Link from 'next/link'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/lib/branches'
import { TransferForm } from '@/components/stock/TransferForm'
import type { BranchCode as Branch } from '@/lib/branches'

export const dynamic = 'force-dynamic';

export default async function TransferPage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  // Get user branches based on role or permissions
  const userBranches = ['ADMIN', 'MANAGER'].includes(user.role)
    ? ALL_BRANCHES
    : (['mombasa', 'nairobi', 'bunje'] as Branch[]) // For now, assume all branches for other roles

  // Get products with stock in any branch (tenant scoped)
  const productRecords = await db.product.findMany({
    where: {
      OR: [
        { currentStock: { gt: 0 } },
        { ProductReceipt: { some: { qtyReceived: { gt: 0 } } } },
        { StockMovement: { some: { quantity: { gt: 0 } } } }
      ]
    },
    orderBy: { sku: 'asc' }
  })

  // Map to the format expected by TransferForm
  const productsWithStock = productRecords.map(p => ({
    id: p.id,
    product_code: p.sku ?? '',
    canonical_name: p.name,
    uom: p.uom,
    stock_levels: userBranches.map(branch => ({ branch, qty: p.currentStock }))
  }))

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <Link href="/stock" className="text-sm text-muted hover:text-text mb-2 inline-block">
            ← Back to stock
          </Link>
          <div className="section-title">Transfer Stock</div>
          <div className="section-sub">Move finished goods between branches</div>
        </div>
      </div>

      <div className="card">
        <TransferForm
          products={productsWithStock}
          userBranches={userBranches}
        />
      </div>

      <div className="mt-4 text-xs text-muted">
        Note: Stock is tracked globally. Transfers create movement logs (transfer_out / transfer_in) for audit purposes.
      </div>
    </div>
  )
}
