import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { withRetry } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { CATEGORY_LABELS } from '@/lib/products'
import type { ProductCategory } from '@prisma/client'
import { DeleteProductButton } from './_components/delete-product-button'
import { ProductCategorySelect } from './_components/product-category-select'
import {
  ProductBranchSelect,
  ProductCurrentStockInput,
  ProductOriginSelect,
  ProductPiecesSetsInput,
} from './_components/product-inline-selects'
import { BRANCH_LABELS, normalizeBranchCode, type BranchCode } from '@/lib/branches'

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const db = getTenantPrisma(user.organizationId)

  const params = await searchParams
  const origin = params.origin as 'FACTORY_MADE' | 'LOCAL_PURCHASE' | 'IMPORTED' | undefined
  const rawCategory = params.category
  const category = rawCategory && rawCategory in CATEGORY_LABELS ? rawCategory as ProductCategory : undefined
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page ?? 1))

  const branches = await db.branch.findMany({
    select: { id: true, name: true, code: true, location: true },
    orderBy: { name: 'asc' },
  })
  const branchOptions: Array<{ code: BranchCode; label: string; id: string }> = []
  const branchByCode = new Map<BranchCode, (typeof branches)[number]>()
  const branchCodeById = new Map<string, BranchCode>()
  for (const branch of branches) {
    const code = normalizeBranchCode(branch.code, branch.name, branch.location)
    if (code) {
      if (!branchByCode.has(code)) {
        branchOptions.push({ code, label: branch.name, id: branch.id })
        branchByCode.set(code, branch)
      }
      branchCodeById.set(branch.id, code)
    }
  }
  const selectedBranch = branchOptions.some((branch) => branch.code === params.branch)
    ? params.branch as BranchCode
    : undefined

  // Build the WHERE clause
  const where: any = {}
  if (origin) where.origin = origin
  if (category) where.category = category
  if (selectedBranch) {
    const branch = branchByCode.get(selectedBranch)
    where.branchId = branch?.id ?? '__missing_branch__'
  }
  if (q) {
    where.OR = [
      { sku: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }

  // Fetch in parallel: category counts, the page of products, total
  const [counts, products, total, stockByBranchRows] = await withRetry(async () => {
    const counts = await db.product.groupBy({
      by: ['origin'],
      _count: { _all: true },
    })
    const products = await db.product.findMany({
      where,
      orderBy: { sku: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        Branch: { select: { id: true, name: true, code: true, location: true } },
        _count: { select: { ProductAlias: true } },
      },
    })
    const total = await db.product.count({ where })
    const stockByBranchRows = await db.product.groupBy({
      by: ['branchId'],
      _count: { _all: true },
      _sum: { currentStock: true, piecesSets: true },
    })

    return [counts, products, total, stockByBranchRows] as const
  })

  const totalAll = counts.reduce((sum, c) => sum + c._count._all, 0)
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const canEditProducts = user.role === 'ADMIN' || user.role === 'MANAGER'

  const countByOrigin: Record<string, number> = {}
  for (const c of counts) countByOrigin[c.origin] = c._count._all

  const tabs: Array<{ key: string; label: string; count: number }> = [
    { key: '', label: 'All', count: totalAll },
    { key: 'FACTORY_MADE', label: 'Factory made', count: countByOrigin.FACTORY_MADE ?? 0 },
    { key: 'LOCAL_PURCHASE', label: 'Local purchase', count: countByOrigin.LOCAL_PURCHASE ?? 0 },
    { key: 'IMPORTED', label: 'Imported', count: countByOrigin.IMPORTED ?? 0 },
  ]

  const branchSummaries = Object.fromEntries(
    branchOptions.map((branch) => [
      branch.code,
      { productCount: 0, stock: 0, piecesSets: 0 },
    ])
  ) as Record<BranchCode, { productCount: number; stock: number; piecesSets: number }>
  let unassignedProductCount = 0
  let unassignedStock = 0
  let unassignedPiecesSets = 0
  for (const row of stockByBranchRows) {
    const code = row.branchId ? branchCodeById.get(row.branchId) : undefined
    if (code && branchSummaries[code]) {
      branchSummaries[code].productCount += row._count._all
      branchSummaries[code].stock += row._sum.currentStock ?? 0
      branchSummaries[code].piecesSets += row._sum.piecesSets ?? 0
    } else {
      unassignedProductCount += row._count._all
      unassignedStock += row._sum.currentStock ?? 0
      unassignedPiecesSets += row._sum.piecesSets ?? 0
    }
  }
  const totalBranchStock = branchOptions.reduce(
    (sum, branch) => sum + (branchSummaries[branch.code]?.stock ?? 0),
    0
  )
  const totalBranchProducts = branchOptions.reduce(
    (sum, branch) => sum + (branchSummaries[branch.code]?.productCount ?? 0),
    0
  )
  const totalBranchPiecesSets = branchOptions.reduce(
    (sum, branch) => sum + (branchSummaries[branch.code]?.piecesSets ?? 0),
    0
  )

  function buildHref(overrides: { origin?: string; category?: string; q?: string; branch?: string; page?: number }) {
    const params = new URLSearchParams()
    const org = overrides.origin ?? origin
    const cat = overrides.category ?? category
    const query = overrides.q ?? q
    const branch = overrides.branch ?? selectedBranch
    const pg = overrides.page ?? page
    if (org) params.set('origin', org)
    if (cat) params.set('category', cat)
    if (query) params.set('q', query)
    if (branch) params.set('branch', branch)
    if (pg > 1) params.set('page', String(pg))
    const qs = params.toString()
    return qs ? `/products?${qs}` : '/products'
  }

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Products</div>
          <div className="section-sub">
            {totalAll} products across all categories and branches
          </div>
        </div>
        <Link href="/products/new" className="btn btn-primary">
          + Add Product
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-16">
        {branchOptions.map((branch) => {
          const summary = branchSummaries[branch.code]
          const active = selectedBranch === branch.code
          return (
            <Link
              key={branch.id}
              href={buildHref({ branch: active ? '' : branch.code, page: 1 })}
              className={`card p-4 ${active ? 'ring-2 ring-accent-amber' : ''}`}
            >
              <div className="text-muted text-xs uppercase tracking-wider">{branch.label}</div>
              <div className="font-mono text-xl mt-2">{summary.stock.toLocaleString()} kg</div>
              <div className="font-mono text-sm mt-1">{summary.piecesSets.toLocaleString()} PCS/Sets</div>
              <div className="text-muted text-xs mt-1">{summary.productCount} products</div>
            </Link>
          )
        })}
        <Link href={buildHref({ branch: '', page: 1 })} className="card p-4">
          <div className="text-muted text-xs uppercase tracking-wider">All branches total</div>
          <div className="font-mono text-xl mt-2">{totalBranchStock.toLocaleString()} kg</div>
          <div className="font-mono text-sm mt-1">{totalBranchPiecesSets.toLocaleString()} PCS/Sets</div>
          <div className="text-muted text-xs mt-1">
            {totalBranchProducts} products
            {unassignedProductCount > 0
              ? ` · ${unassignedStock.toLocaleString()} kg / ${unassignedPiecesSets.toLocaleString()} PCS/Sets unassigned`
              : ''}
          </div>
        </Link>
      </div>

      {/* ORIGIN FILTERS */}
      <div className="section-header mb-6">
        <div className="section-title">Filter by Origin</div>
        <div className="section-sub">Click any tab to filter the list</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-16">
        {tabs.map((tab) => {
          const isActive = (tab.key || '') === (origin || '')
          return (
            <Link
              key={tab.key}
              href={buildHref({ origin: tab.key, page: 1 })}
              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab.label} ({tab.count})
            </Link>
          )
        })}
      </div>

      {/* SEARCH */}
      <div className="section-header mb-6">
        <div className="section-title">Search Products</div>
        <div className="section-sub">Find by SKU or name</div>
      </div>

      <form className="mb-16 flex gap-2 items-end">
        {origin && <input type="hidden" name="origin" value={origin} />}
        <div className="form-group max-w-md flex-1">
          <label className="form-label">Search</label>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by SKU or product name..."
            className="form-input"
          />
        </div>
        <div className="form-group" style={{minWidth:'220px'}}>
          <label className="form-label">Category</label>
          <select name="category" defaultValue={category ?? ''} className="form-input">
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{minWidth:'180px'}}>
          <label className="form-label">Branch</label>
          <select name="branch" defaultValue={selectedBranch ?? ''} className="form-input">
            <option value="">All branches</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.code}>
                {branch.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary h-[42px]">
          Search
        </button>
        {(q || category || selectedBranch) && (
          <Link href={buildHref({ q: '', category: '', branch: '', page: 1 })} className="btn btn-ghost h-[42px]">
            Clear
          </Link>
        )}
      </form>

      <div className="section-header mb-8">
        <div className="section-title">
          {origin ? `${tabs.find(t => t.key === origin)?.label} Products` : 'All Products'}
        </div>
        <div className="section-sub">
          {q || category
            ? `Filtered results${q ? ` for "${q}"` : ''}${category ? ` in ${CATEGORY_LABELS[category]}` : ''}`
            : `${total} products found`}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Origin</th>
                <th>UOM</th>
                <th>Branch</th>
                <th>Current Stock</th>
                <th>PCS/Sets</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted text-sm">
                    {q || origin || category ? (
                      <div>
                        No products match your search criteria.{' '}
                        <Link href="/products" className="text-accent-amber hover:underline">
                          Clear filters
                        </Link>
                      </div>
                    ) : (
                      <div>
                        No products found.{' '}
                        <Link href="/products/new" className="text-accent-amber hover:underline">
                          Add your first product
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/products/${p.id}`} className="font-mono text-accent-amber hover:underline">
                        {p.sku}
                      </Link>
                    </td>
                     <td className="truncate max-w-xs">{p.name}</td>
                     <td>
                       <ProductCategorySelect
                         productId={p.id}
                         category={p.category}
                         canEdit={canEditProducts}
                       />
                     </td>
                     <td>
                       <ProductOriginSelect
                         productId={p.id}
                         origin={p.origin}
                         canEdit={canEditProducts}
                       />
                     </td>
                    <td>
                      <span className="badge badge-muted">KG</span>
                    </td>
                    <td>
                      {(() => {
                        const code = p.Branch
                          ? normalizeBranchCode(p.Branch.code, p.Branch.name, p.Branch.location)
                          : null
                        return (
                          <ProductBranchSelect
                            productId={p.id}
                            branch={code}
                            branchLabel={code ? BRANCH_LABELS[code] : p.Branch?.name ?? 'Unassigned'}
                            canEdit={canEditProducts}
                          />
                        )
                      })()}
                    </td>
                    <td>
                      <ProductCurrentStockInput
                        productId={p.id}
                        currentStock={p.currentStock}
                        canEdit={canEditProducts}
                      />
                    </td>
                    <td>
                      <ProductPiecesSetsInput
                        productId={p.id}
                        piecesSets={p.piecesSets}
                        canEdit={canEditProducts}
                      />
                    </td>
                    <td>
                      <span className="badge badge-teal">
                        Active
                      </span>
                    </td>
                    <td>
                      <div className="flex items-start gap-2">
                        <Link 
                          href={`/products/${p.id}/edit`} 
                          className="btn btn-ghost btn-sm"
                        >
                          Edit
                        </Link>
                        {user.role === 'ADMIN' && (
                          <DeleteProductButton productId={p.id} productName={p.name} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
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
