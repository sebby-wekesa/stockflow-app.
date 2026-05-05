import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ALL_BRANCHES, BRANCH_LABELS, BRANCH_SUB, formatKES } from '@/lib/branches'
import { CATEGORY_BADGE_CLASS, CATEGORY_SHORT } from '@/lib/products'
import { StockSearch } from './_components/stock-search'
import { TransferButton } from './_components/transfer-button'
import type { Branch, ProductCategory } from '@prisma/client'

const PAGE_SIZE = 50

export default async function BranchStockPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; branch?: string; page?: string }
}) {
  const q = searchParams.q?.trim() ?? ''
  const category = searchParams.category as ProductCategory | undefined
  const focusedBranch = searchParams.branch as Branch | undefined
  const page = Math.max(1, Number(searchParams.page ?? 1))

  // Build product filter
  const productWhere: any = {
    is_active: true,
    category: category ?? { not: 'service' },
  }
  if (q) {
    productWhere.OR = [
      { product_code: { contains: q, mode: 'insensitive' } },
      { canonical_name: { contains: q, mode: 'insensitive' } },
    ]
  }

  // Fetch all the dashboard data in parallel
  const [products, total, branchSummaries, lowStockCount] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      orderBy: { product_code: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { stock_levels: true },
    }),
    prisma.product.count({ where: productWhere }),
    Promise.all(
      ALL_BRANCHES.map(async (branch) => {
        const [stockAgg, lowStock] = await Promise.all([
          prisma.branchStock.aggregate({
            where: { branch, qty: { gt: 0 } },
            _sum: { qty: true },
            _count: { _all: true },
          }),
          prisma.branchStock.count({ where: { branch, qty: { gt: 0, lt: 5 } } }),
        ])

        // Compute approximate value: sum(qty * selling_price) for stocked products
        const valuedStock = await prisma.branchStock.findMany({
          where: { branch, qty: { gt: 0 } },
          include: { product: { select: { selling_price: true } } },
        })
        const value = valuedStock.reduce(
          (sum, s) => sum + s.qty * (Number(s.product.selling_price) || 0),
          0
        )

        return {
          branch,
          totalUnits: stockAgg._sum.qty ?? 0,
          totalSkus: stockAgg._count._all,
          value,
          lowStock,
        }
      })
    ),
    prisma.branchStock.count({ where: { qty: { gt: 0, lt: 5 } } }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildHref(overrides: { q?: string; category?: string; branch?: string; page?: number }) {
    const params = new URLSearchParams()
    const _q = overrides.q ?? q
    const _cat = overrides.category ?? category
    const _branch = overrides.branch ?? focusedBranch
    const _page = overrides.page ?? page
    if (_q) params.set('q', _q)
    if (_cat) params.set('category', _cat)
    if (_branch) params.set('branch', _branch)
    if (_page > 1) params.set('page', String(_page))
    const qs = params.toString()
    return qs ? `/stock?${qs}` : '/stock'
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-head text-2xl font-bold">Branch stock</h1>
          <p className="text-muted text-sm mt-1">
            Live inventory across all three branches · {lowStockCount} items below reorder point
          </p>
        </div>
        <TransferButton />
      </div>

      {/* BRANCH SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {branchSummaries.map(({ branch, totalUnits, totalSkus, value, lowStock }) => {
          const isFocused = focusedBranch === branch
          const accentClass =
            branch === 'mombasa'
              ? 'border-t-accent'
              : branch === 'nairobi'
              ? 'border-t-teal'
              : 'border-t-purple'
          return (
            <Link
              key={branch}
              href={
                isFocused
                  ? buildHref({ branch: '', page: 1 })
                  : buildHref({ branch, page: 1 })
              }
              className={`card p-5 border-t-4 ${accentClass} transition-all ${
                isFocused
                  ? 'ring-1 ring-accent'
                  : 'hover:bg-surface2'
              }`}
            >
              <div className="font-head text-lg font-bold">{BRANCH_LABELS[branch]}</div>
              <div className="text-xs text-muted mb-3">{BRANCH_SUB[branch]}</div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">SKUs in stock</span>
                  <span className="font-mono font-medium">{totalSkus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total units</span>
                  <span className="font-mono font-medium">{totalUnits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Stock value</span>
                  <span className="font-mono font-medium">{formatKES(value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Low stock alerts</span>
                  <span
                    className={`font-mono font-medium ${
                      lowStock > 0 ? 'text-red' : 'text-muted'
                    }`}
                  >
                    {lowStock}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* CATEGORY TABS */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Link
          href={buildHref({ category: '', page: 1 })}
          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
            !category
              ? 'bg-accent border-accent text-bg font-semibold'
              : 'bg-surface border-border text-muted hover:border-accent hover:text-text'
          }`}
        >
          All categories
        </Link>
        {(['manufactured_spring', 'manufactured_ubolt', 'imported', 'local_purchase'] as const).map(
          (cat) => (
            <Link
              key={cat}
              href={buildHref({ category: cat, page: 1 })}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                category === cat
                  ? 'bg-accent border-accent text-bg font-semibold'
                  : 'bg-surface border-border text-muted hover:border-accent hover:text-text'
              }`}
            >
              {CATEGORY_SHORT[cat as ProductCategory]}
            </Link>
          )
        )}
      </div>

      <StockSearch initialQuery={q} category={category} branch={focusedBranch} />

      {/* PRODUCT TABLE */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Mombasa</th>
                <th className="px-4 py-3 font-medium text-right">Nairobi</th>
                <th className="px-4 py-3 font-medium text-right">Bonje</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted text-sm">
                    {q || category || focusedBranch ? (
                      <>
                        No products match these filters.{' '}
                        <Link href="/stock" className="text-accent hover:underline">
                          Clear filters
                        </Link>
                      </>
                    ) : (
                      <>
                        No products yet.{' '}
                        <Link href="/import" className="text-accent hover:underline">
                          Import data
                        </Link>{' '}
                        or{' '}
                        <Link href="/products/new" className="text-accent hover:underline">
                          add a product
                        </Link>
                        .
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const stockByBranch: Record<string, number> = Object.fromEntries(
                    p.stock_levels.map((s) => [s.branch, s.qty])
                  )
                  const total = p.stock_levels.reduce((sum, s) => sum + s.qty, 0)
                  const reorderPoint = p.reorder_point ?? 0
                  const isLow = reorderPoint > 0 && total < reorderPoint
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-surface2">
                      <td className="px-4 py-3">
                        <Link
                          href={`/products/${p.id}`}
                          className="font-mono text-sm text-accent hover:underline"
                        >
                          {p.product_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm truncate max-w-xs">
                        <Link href={`/products/${p.id}`} className="hover:underline">
                          {p.canonical_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            CATEGORY_BADGE_CLASS[p.category]
                          }`}
                        >
                          {CATEGORY_SHORT[p.category]}
                        </span>
                      </td>
                      {(['mombasa', 'nairobi', 'bonje'] as const).map((branch) => {
                        const qty = stockByBranch[branch] ?? 0
                        return (
                          <td key={branch} className="px-4 py-3 text-right font-mono text-sm">
                            <span className={qty === 0 ? 'text-muted' : ''}>{qty}</span>
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        <span
                          className={
                            isLow
                              ? 'text-red'
                              : total > 0
                              ? 'text-teal'
                              : 'text-muted'
                          }
                        >
                          {total}
                        </span>
                        {isLow && (
                          <span className="ml-1 text-[10px] text-red" title="Below reorder point">
                            ⚠
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
            <div className="text-muted">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={buildHref({ page: page - 1 })} className="btn btn-ghost btn-sm">
                  ← Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={buildHref({ page: page + 1 })} className="btn btn-ghost btn-sm">
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
