import Link from 'next/link'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { ALL_BRANCHES, BRANCH_LABELS, BRANCH_SUB, normalizeBranchCode } from '@/lib/branches'
import { TransferForm } from '@/components/stock/TransferForm'
import type { BranchCode as Branch } from '@/lib/branches'

export const dynamic = 'force-dynamic';

export default async function TransferPage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  const branchRecords = await db.branch.findMany({
    select: { id: true, name: true, code: true, location: true },
    orderBy: { name: 'asc' },
  })
  const branchCodeById = new Map<string, Branch>()
  const branchIdByCode = new Map<Branch, string>()
  const branchCodeByStoredId = new Map<string, Branch>()

  for (const branch of branchRecords) {
    const code = normalizeBranchCode(branch.code, branch.name, branch.location)
    if (code) {
      branchCodeById.set(branch.id, code)
      branchIdByCode.set(code, branch.id)
      branchCodeByStoredId.set(branch.id, code)
      branchCodeByStoredId.set(branch.code, code)
      branchCodeByStoredId.set(code, code)
    }
  }

  const configuredBranches = ALL_BRANCHES.filter((branch) => branchIdByCode.has(branch))
  const assignedBranchCode = user.branches[0]
    ? branchCodeById.get(user.branches[0].id) ?? normalizeBranchCode(user.branches[0].name)
    : null
  const sourceBranches = ['ADMIN', 'MANAGER'].includes(user.role)
    ? configuredBranches
    : assignedBranchCode && configuredBranches.includes(assignedBranchCode)
      ? [assignedBranchCode]
      : []
  const sourceBranchStoredIds = sourceBranches.flatMap((branch) => {
    const branchRecord = branchRecords.find((candidate) =>
      normalizeBranchCode(candidate.code, candidate.name, candidate.location) === branch
    )
    return branchRecord ? [branchRecord.id, branchRecord.code, branch] : []
  })

  // Products are branch-owned rows. Only load source-branch stock for the picker.
  const productRecords = await db.product.findMany({
    where: {
      branchId: { in: sourceBranchStoredIds },
      currentStock: { gt: 0 },
    },
    orderBy: { sku: 'asc' }
  })

  const productsWithStock = productRecords.flatMap((product) => {
    const branch = product.branchId ? branchCodeByStoredId.get(product.branchId) : null
    if (!branch) return []

    return [{
      id: product.id,
      product_code: product.sku ?? '',
      canonical_name: product.name,
      uom: product.uom,
      stock_levels: [{ branch, qty: product.currentStock }],
    }]
  })

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
        <span className="badge badge-amber stock-transfer-status">{assignedBranchCode ? `${BRANCH_LABELS[assignedBranchCode]} stock` : 'Inventory movement'}</span>
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
            userBranches={configuredBranches}
            sourceBranches={sourceBranches}
            initialSourceBranch={
              assignedBranchCode && sourceBranches.includes(assignedBranchCode)
                ? assignedBranchCode
                : sourceBranches[0]
            }
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
              {configuredBranches.map((branch) => (
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
