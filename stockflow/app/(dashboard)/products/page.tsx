import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CATEGORY_SHORT, CATEGORY_BADGE_CLASS } from '@/lib/products'
import type { ProductCategory } from '@prisma/client'

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const origin = params.origin as 'FACTORY_MADE' | 'LOCAL_PURCHASE' | 'IMPORTED' | undefined
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page ?? 1))

  // Build the WHERE clause
  const where: any = {}
  if (origin) where.origin = origin
  if (q) {
    where.OR = [
      { sku: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }

  // Fetch in parallel: category counts, the page of products, total
  const [counts, products, total] = await Promise.all([
    prisma.product.groupBy({
      by: ['origin'],
      _count: { _all: true },
    }),
    prisma.product.findMany({
      where,
      orderBy: { sku: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        _count: { select: { ProductAlias: true } },
      },
    }),
    prisma.product.count({ where }),
  ])

  const totalAll = counts.reduce((sum, c) => sum + c._count._all, 0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const countByOrigin: Record<string, number> = {}
  for (const c of counts) countByOrigin[c.origin] = c._count._all

  const tabs: Array<{ key: string; label: string; count: number }> = [
    { key: '', label: 'All', count: totalAll },
    { key: 'FACTORY_MADE', label: 'Factory made', count: countByOrigin.FACTORY_MADE ?? 0 },
    { key: 'LOCAL_PURCHASE', label: 'Local purchase', count: countByOrigin.LOCAL_PURCHASE ?? 0 },
    { key: 'IMPORTED', label: 'Imported', count: countByOrigin.IMPORTED ?? 0 },
  ]

  function buildHref(overrides: { origin?: string; q?: string; page?: number }) {
    const params = new URLSearchParams()
    const org = overrides.origin ?? origin
    const query = overrides.q ?? q
    const pg = overrides.page ?? page
    if (org) params.set('origin', org)
    if (query) params.set('q', query)
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

      {/* CATEGORY TABS */}
      <div className="section-header mb-8">
        <div className="section-title">Filter by Origin</div>
        <div className="section-sub">Click any category to filter the product list</div>
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

      {/* SEARCH FORM */}
      <div className="section-header mb-8">
        <div className="section-title">Search Products</div>
        <div className="section-sub">Find products by SKU or name</div>
      </div>

      <form className="mb-16">
        {origin && <input type="hidden" name="origin" value={origin} />}
        <div className="form-group max-w-md">
          <label className="form-label">Search</label>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by SKU or product name..."
            className="form-input"
          />
        </div>
      </form>

      <div className="section-header mb-8">
        <div className="section-title">
          {origin ? `${tabs.find(t => t.key === origin)?.label} Products` : 'All Products'}
        </div>
        <div className="section-sub">
          {q ? `Search results for "${q}"` : `${total} products found`}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Origin</th>
                <th>UOM</th>
                <th>Current Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted text-sm">
                    {q || origin ? (
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
                      <span className={`badge ${CATEGORY_BADGE_CLASS[p.origin] || 'badge-muted'}`}>
                        {CATEGORY_SHORT[p.origin] || p.origin}
                      </span>
                    </td>
                    <td className="text-sm uppercase">{p.uom}</td>
                    <td className="font-mono text-sm">
                      {p.currentStock.toLocaleString()}
                    </td>
                    <td>
                      <span className="badge badge-teal">
                        Active
                      </span>
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