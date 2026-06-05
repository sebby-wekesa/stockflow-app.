export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { redirect } from 'next/navigation'
import { ALL_BRANCHES, BRANCH_LABELS, BRANCH_SUB, formatKES } from '@/lib/branches'
import ExportStockButton from './_components/ExportStockButton'
import { CATEGORY_BADGE_CLASS, CATEGORY_LABELS, CATEGORY_SHORT, isProductCategory } from '@/lib/products'
import type { BranchCode as Branch } from '@/lib/branches'

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const variants = {
    AVAILABLE: 'badge-green',
    LOW_STOCK: 'badge-amber',
    OUT_OF_STOCK: 'badge-red',
    REORDER_NEEDED: 'badge-red',
  }

  const labels = {
    AVAILABLE: 'Available',
    LOW_STOCK: 'Low Stock',
    OUT_OF_STOCK: 'Out of Stock',
    REORDER_NEEDED: 'Re-Order',
  }

  return (
    <span className={`badge ${variants[status as keyof typeof variants] || 'badge-muted'}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  )
}

const PAGE_SIZE = 50

export default async function BranchStockPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; page?: string; search?: string; category?: string; status?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const db = getTenantPrisma(user.organizationId)

  const params = await searchParams;
  const focusedBranch = params.branch as Branch | undefined
  const page = Math.max(1, Number(params.page ?? 1))
  const category = isProductCategory(params.category) ? params.category : undefined

  // Build product filter
  const productWhere: any = {}

  // Add search filter if provided
  if (params.search) {
    productWhere.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { sku: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  // Add category filter if provided
  if (category) {
    productWhere.category = category
  }

  // Add status filter if provided
  if (params.status) {
    productWhere.stockStatus = params.status
  }

  // Fetch the page data with a small fixed query count. The branch summary
  // is reduced in memory to avoid a per-branch aggregate/count fan-out.
  const [products, total, allRawStock, allFinishedStock] = await Promise.all([
    db.product.findMany({
      where: productWhere,
      orderBy: { sku: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.product.count({ where: productWhere }),

    // All raw + finished stock (for per-product branch breakdown)
    db.inventoryRawMaterial.findMany({
      where: { availableKg: { gt: 0 } },
      include: {
        Branch: { select: { code: true } },
        RawMaterial: { select: { id: true, costPerKg: true } },
      },
    }),
    db.inventoryFinishedGoods.findMany({
      where: { availableQty: { gt: 0 } },
      include: {
        Branch: { select: { code: true } },
        FinishedGoods: { select: { id: true, unitCost: true } },
      },
    }),
  ])

  const branchSummaries = ALL_BRANCHES.map((branch) => {
    const rawStock = allRawStock.filter((stock) => stock.Branch.code === branch)
    const finishedStock = allFinishedStock.filter((stock) => stock.Branch.code === branch)
    const rawValue = rawStock.reduce(
      (sum, stock) => sum + Number(stock.availableKg) * (Number(stock.RawMaterial?.costPerKg) || 0),
      0
    )
    const finishedValue = finishedStock.reduce(
      (sum, stock) => sum + Number(stock.availableQty) * (Number(stock.FinishedGoods?.unitCost) || 0),
      0
    )

    return {
      branch,
      totalUnits:
        rawStock.reduce((sum, stock) => sum + Number(stock.availableKg), 0) +
        finishedStock.reduce((sum, stock) => sum + Number(stock.availableQty), 0),
      totalSkus: rawStock.length + finishedStock.length,
      value: rawValue + finishedValue,
      lowStock:
        rawStock.filter((stock) => Number(stock.availableKg) < 5).length +
        finishedStock.filter((stock) => Number(stock.availableQty) < 5).length,
    }
  })

  const lowStockCount = branchSummaries.reduce((sum, summary) => sum + summary.lowStock, 0)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Helper function to get stock for a product across branches
  function getStockByBranch(productId: string) {
    const stockByBranch: Record<Branch, number> = {
      mombasa: 0,
      nairobi: 0,
      bunje: 0,
    }

    // Add raw material stock
    allRawStock.forEach(stock => {
      if (stock.RawMaterial.id === productId) {
        stockByBranch[stock.Branch.code as Branch] = Number(stock.availableKg)
      }
    })

    // Add finished goods stock
    allFinishedStock.forEach(stock => {
      if (stock.FinishedGoods.id === productId) {
        stockByBranch[stock.Branch.code as Branch] = Number(stock.availableQty)
      }
    })

    return stockByBranch
  }

  function buildHref(overrides: { branch?: string; page?: number }) {
    const params = new URLSearchParams()
    const _branch = overrides.branch ?? focusedBranch
    const _page = overrides.page ?? page
    if (_branch) params.set('branch', _branch)
    if (_page > 1) params.set('page', String(_page))
    const qs = params.toString()
    return qs ? `/stock?${qs}` : '/stock'
  }

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Branch Stock</div>
          <div className="section-sub">
            Live inventory across all three branches · {lowStockCount} items below reorder point
          </div>
        </div>
        <Link href="/stock/transfer" className="btn btn-primary">
          Transfer Stock
        </Link>
      </div>

      {/* Inventory Dashboard */}
      <div className="section-header mb-16">
        <div><div className="section-title">Mombasa Inventory Dashboard</div><div className="section-sub">Real-time stock levels and status monitoring</div></div>
        <Link href="/import" className="btn btn-primary">Import Stock Data</Link>
      </div>

      {/* Metric Cards */}
      <div className="stats-grid mb-16">
        <div className="stat-card teal">
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{total}</div>
          <div className="stat-sub">Products in inventory</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Low Stock Alerts</div>
          <div className="stat-value">{lowStockCount}</div>
          <div className="stat-sub">Items below reorder level</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Out of Stock</div>
          <div className="stat-value">{products.filter(p => (p.currentStock || 0) <= 0).length}</div>
          <div className="stat-sub">Items unavailable</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Total Valuation</div>
          <div className="stat-value">
            {formatKES(products.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.unitCost || 0)), 0))}
          </div>
          <div className="stat-sub">Estimated value</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card mb-16">
        <div className="section-header mb-16">
          <div className="section-title">Search & Filter Inventory</div>
        </div>

        <form className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="form-group">
            <label className="form-label">Search</label>
            <input
              type="text"
              name="search"
              defaultValue={params.search}
              placeholder="Product name or SKU..."
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select name="category" defaultValue={category ?? ''} className="form-input">
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select name="status" defaultValue={params.status} className="form-input">
              <option value="">All Status</option>
              <option value="AVAILABLE">Available</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="REORDER_NEEDED">Re-Order</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>

          <div className="form-group flex items-end">
            <button type="submit" className="btn btn-primary w-full">Search</button>
          </div>
        </form>
      </div>

      {/* BRANCH SUMMARY CARDS */}
      <div className="section-header mb-8">
        <div className="section-title">Branch Overview</div>
        <div className="section-sub">Click any branch to filter the product table below</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {branchSummaries.map(({ branch, totalUnits, totalSkus, value, lowStock }) => {
          const isFocused = focusedBranch === branch
          return (
            <Link
              key={branch}
              href={
                isFocused
                  ? buildHref({ branch: '', page: 1 })
                  : buildHref({ branch, page: 1 })
              }
              className={`card transition-all ${
                isFocused
                  ? 'ring-2 ring-accent-amber border-accent-amber'
                  : 'hover:border-accent-amber/50'
              }`}
            >
              <div className="p-6">
                <div className="section-title mb-2">{BRANCH_LABELS[branch]}</div>
                <div className="text-muted text-sm mb-4">{BRANCH_SUB[branch]}</div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted text-sm">SKUs in stock</span>
                    <span className="font-mono font-medium">{totalSkus}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted text-sm">Total units</span>
                    <span className="font-mono font-medium">{totalUnits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted text-sm">Stock value</span>
                    <span className="font-mono font-medium">{formatKES(value)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted text-sm">Low stock alerts</span>
                    <span
                      className={`font-mono font-medium ${
                        lowStock > 0 ? 'text-red' : 'text-muted'
                      }`}
                    >
                      {lowStock}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>





      {/* PRODUCT TABLE */}
      <div className="section-header mb-8">
        <div className="section-title">
          Mombasa Inventory Items
        </div>
        <div className="section-sub">
          {total} products in stock · Real-time inventory from imported data
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <Link href="/stock/transfer" className="btn btn-primary">
          Transfer stock
        </Link>
        <Link href="/import" className="btn btn-ghost">
          Import Data
        </Link>
        <ExportStockButton products={products} />
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Balance</th>
                <th>UOM</th>
                <th>Status</th>
                <th className="text-right">Value</th>
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted text-sm">
                    No products found.
                  </td>
                </tr>
              ) : (
                  products.map((p) => {
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="font-mono text-accent-amber mb-1">{p.sku}</div>
                          <div className="text-muted text-sm truncate max-w-xs">{p.name}</div>
                        </td>
                        <td>
                          <span className={`badge ${CATEGORY_BADGE_CLASS[p.category] || 'badge-muted'}`}>
                            {CATEGORY_SHORT[p.category] || p.category}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/stock/ledger?productId=${p.id}`}
                            className="text-accent-amber hover:underline text-sm"
                          >
                            View History
                          </Link>
                        </td>
                        <td className="font-mono">
                          {p.currentStock?.toFixed(1) || '0'}
                        </td>
                        <td>
                          <span className="text-muted text-sm">{p.uom}</span>
                        </td>
                        <td>
                          <StatusBadge status={p.stockStatus || 'AVAILABLE'} />
                        </td>
                        <td className="text-right font-mono">
                          {formatKES((p.currentStock || 0) * (p.unitCost || 0))}
                        </td>
                      </tr>
                    )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="text-muted text-sm">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} products
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={buildHref({ page: page - 1 })} className="btn btn-secondary">
                  Previous
                </Link>
              )}
              <span className="px-4 py-2 bg-surface-secondary border border-border rounded-md text-muted text-sm">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link href={buildHref({ page: page + 1 })} className="btn btn-secondary">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StockCell({ qty, branch, focused }: { qty: number; branch: Branch; focused?: boolean }) {
  const lowStock = qty > 0 && qty < 5
  return (
    <span className={`${focused ? 'font-bold' : ''} ${lowStock ? 'text-red' : qty > 0 ? 'text-primary' : 'text-muted'}`}>
      {qty > 0 ? qty.toLocaleString() : '—'}
    </span>
  )
}
