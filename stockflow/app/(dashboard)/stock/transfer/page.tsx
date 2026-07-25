import Link from 'next/link'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { ALL_BRANCHES, BRANCH_LABELS, BRANCH_SUB, normalizeBranchCode } from '@/lib/branches'
import { TransferForm } from '@/components/stock/TransferForm'
import { PendingTransfers, type PendingTransferItem } from '@/components/stock/PendingTransfers'
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
  const sourceBranchIds = sourceBranches
    .map((branch) => branchIdByCode.get(branch))
    .filter((branchId): branchId is string => Boolean(branchId))
  const isSuperUser = user.role === 'ADMIN' && user.branches.length === 0
  const receivingBranchIds = isSuperUser
    ? branchRecords.map((branch) => branch.id)
    : user.branches.map((branch) => branch.id)

  const pendingTransferRecords = receivingBranchIds.length === 0
    ? []
    : await db.stockTransfer.findMany({
        where: {
          status: 'PENDING',
          destinationBranchId: { in: receivingBranchIds },
        },
        select: {
          id: true,
          reference: true,
          quantity: true,
          quantityUnit: true,
          createdAt: true,
          notes: true,
          Product: { select: { sku: true, name: true } },
          SourceBranch: { select: { name: true } },
          DestinationBranch: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
  const pendingTransfers: PendingTransferItem[] = pendingTransferRecords.map((transfer) => ({
    id: transfer.id,
    reference: transfer.reference,
    productCode: transfer.Product.sku ?? 'Product',
    productName: transfer.Product.name,
    quantity: transfer.quantity,
    quantityUnit: transfer.quantityUnit,
    sourceBranchName: transfer.SourceBranch.name,
    destinationBranchName: transfer.DestinationBranch.name,
    createdAt: transfer.createdAt.toISOString(),
    notes: transfer.notes,
  }))

  // Products are catalog rows. Load the source-branch catalogue plus products
  // that have received stock there, so a destination branch can transfer the
  // received balance onward later.
  const productRecords = await db.product.findMany({
    where: {
      OR: [
        { branchId: { in: sourceBranchStoredIds } },
        {
          branchStocks: {
            some: {
              branchId: { in: sourceBranchIds },
            },
          },
        },
      ],
    },
    include: {
      branchStocks: {
        where: { branchId: { in: sourceBranchIds } },
        select: { branchId: true, availableQty: true, availablePiecesSets: true },
      },
    },
    orderBy: { sku: 'asc' }
  })

  const productsWithStock = productRecords.flatMap((product) => {
    const stock_levels = sourceBranchIds.flatMap((branchId) => {
      const branch = branchCodeById.get(branchId)
      if (!branch) return []

      const branchStock = product.branchStocks.find((stock) => stock.branchId === branchId)
      const isProductOwnedByBranch = product.branchId
        ? branchCodeByStoredId.get(product.branchId) === branch
        : false
      const qty = branchStock?.availableQty ?? (isProductOwnedByBranch ? product.currentStock : 0)
      const piecesSets = branchStock?.availablePiecesSets ?? (isProductOwnedByBranch ? product.piecesSets : 0)

      return [{ branch, qty, pieces_sets: piecesSets }]
    })

    if (stock_levels.length === 0) return []

    return [{
      id: product.id,
      product_code: product.sku ?? '',
      canonical_name: product.name,
      uom: product.uom,
      stock_levels,
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
        <div className="flex items-center gap-2">
          <Link href="/stock/transfer/history" className="btn btn-ghost btn-sm">Transfer history</Link>
          <span className="badge badge-amber stock-transfer-status">{isSuperUser ? 'All branches' : assignedBranchCode ? `${BRANCH_LABELS[assignedBranchCode]} stock` : 'Inventory movement'}</span>
        </div>
      </div>

      <div className="stock-transfer-layout">
        <section className="card stock-transfer-card">
          <div className="stock-transfer-card-header">
            <div>
              <div className="stock-transfer-kicker">New handoff</div>
              <div className="section-title">Transfer details</div>
              <div className="section-sub">
                Choose a source, destination, products, and quantities.
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
              Select one or more products at the sending branch, then record where they are going.
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
              Dispatch creates the outbound log. The receiving branch confirms the inbound movement when stock arrives.
            </p>
          </section>
        </aside>
      </div>

      {pendingTransfers.length > 0 && <PendingTransfers transfers={pendingTransfers} />}

      <div className="stock-transfer-note">
        <span className="stock-transfer-note-label">Stock control</span>
        <span>Only available stock can be transferred. Each quantity is checked against the source branch before dispatch.</span>
      </div>
    </div>
  )
}
