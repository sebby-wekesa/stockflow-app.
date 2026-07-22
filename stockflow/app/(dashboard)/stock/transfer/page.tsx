import Link from 'next/link'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { ALL_BRANCHES, BRANCH_LABELS, BRANCH_SUB } from '@/lib/branches'
import { TransferForm } from '@/components/stock/TransferForm'
import type { BranchCode as Branch } from '@/lib/branches'

export const dynamic = 'force-dynamic';

export default async function TransferPage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  // Get user branches based on role or permissions
  const userBranches = ['ADMIN', 'MANAGER'].includes(user.role)
    ? ALL_BRANCHES
    : (['mombasa', 'nairobi', 'bonje'] as Branch[]) // For now, assume all branches for other roles

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
    <div className="stock-transfer-page">
      <div className="section-header stock-transfer-header">
        <div>
          <Link href="/stock" className="stock-transfer-back">
            ← Stock overview
          </Link>
          <div className="section-title">Transfer stock</div>
          <div className="section-sub">
            Move finished goods between branches and keep the handoff auditable.
          </div>
        </div>
        <span className="badge badge-amber stock-transfer-status">Inventory movement</span>
      </div>

      <div className="stock-transfer-layout">
        <section className="card stock-transfer-card">
          <div className="stock-transfer-card-header">
            <div>
              <div className="stock-transfer-kicker">New handoff</div>
              <div className="section-title">Transfer details</div>
              <div className="section-sub">
                Choose a source, destination, product, and quantity.
              </div>
            </div>
            <div className="stock-transfer-card-mark" aria-hidden="true">↗</div>
          </div>

          <TransferForm
            products={productsWithStock}
            userBranches={userBranches}
          />
        </section>

        <aside className="stock-transfer-aside">
          <section className="card stock-transfer-route-card">
            <div className="stock-transfer-kicker">Available routes</div>
            <div className="section-title">Branch handoff</div>
            <p className="stock-transfer-aside-copy">
              Select stock at the sending branch, then record where it is going.
            </p>

            <div className="stock-transfer-branch-list">
              {userBranches.map((branch) => (
                <div key={branch} className="stock-transfer-branch-row">
                  <span className={`stock-transfer-branch-dot ${branch}`} aria-hidden="true" />
                  <div>
                    <div className="stock-transfer-branch-name">{BRANCH_LABELS[branch]}</div>
                    <div className="stock-transfer-branch-sub">{BRANCH_SUB[branch]}</div>
                  </div>
                  <span className="stock-transfer-branch-code">{branch.slice(0, 3).toUpperCase()}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card stock-transfer-audit-card">
            <span className="badge badge-teal">Audit trail</span>
            <div className="section-title">Every move is recorded</div>
            <p className="stock-transfer-aside-copy">
              Transfers create paired outbound and inbound movement logs so stock history stays traceable.
            </p>
          </section>
        </aside>
      </div>

      <div className="stock-transfer-note">
        <span className="stock-transfer-note-label">Stock control</span>
        <span>Only available stock can be transferred. The quantity is checked against the source branch before dispatch.</span>
      </div>
    </div>
  )
}
