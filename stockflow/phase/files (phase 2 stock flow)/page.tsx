import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CATEGORY_SHORT, CATEGORY_BADGE_CLASS } from '@/lib/products'
import { ProductSearch } from './_components/product-search'
import type { ProductCategory } from '@prisma/client'

const PAGE_SIZE = 50

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string; page?: string }
}) {
  const category = searchParams.category as ProductCategory | undefined
  const q = searchParams.q?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))

  // Build the WHERE clause
  const where: any = {}
  if (category) where.category = category
  if (q) {
    where.OR = [
      { product_code: { contains: q, mode: 'insensitive' } },
      { canonical_name: { contains: q, mode: 'insensitive' } },
    ]
  }

  // Fetch in parallel: category counts, the page of products, total
  const [counts, products, total] = await Promise.all([
    prisma.product.groupBy({
      by: ['category'],
      _count: { _all: true },
    }),
    prisma.product.findMany({
      where,
      orderBy: { product_code: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        _count: { select: { aliases: true } },
        stock_levels: { select: { qty: true } },
      },
    }),
    prisma.product.count({ where }),
  ])

  const totalAll = counts.reduce((sum, c) => sum + c._count._all, 0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const countByCategory: Record<string, number> = {}
  for (const c of counts) countByCategory[c.category] = c._count._all

  const tabs: Array<{ key: string; label: string; count: number }> = [
    { key: '', label: 'All', count: totalAll },
    { key: 'manufactured_spring', label: 'Manufactured springs', count: countByCategory.manufactured_spring ?? 0 },
    { key: 'manufactured_ubolt', label: 'Manufactured U-bolts', count: countByCategory.manufactured_ubolt ?? 0 },
    { key: 'imported', label: 'Imported', count: countByCategory.imported ?? 0 },
    { key: 'local_purchase', label: 'Local purchase', count: countByCategory.local_purchase ?? 0 },
    { key: 'service', label: 'Services', count: countByCategory.service ?? 0 },
  ]

  function buildHref(overrides: { category?: string; q?: string; page?: number }) {
    const params = new URLSearchParams()
    const cat = overrides.category ?? category
    const query = overrides.q ?? q
    const pg = overrides.page ?? page
    if (cat) params.set('category', cat)
    if (query) params.set('q', query)
    if (pg > 1) params.set('page', String(pg))
    const qs = params.toString()
    return qs ? `/products?${qs}` : '/products'
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-head text-2xl font-bold">Product master</h1>
          <p className="text-muted text-sm mt-1">
            {totalAll} canonical products across 5 categories · alias resolution active
          </p>
        </div>
        <Link href="/products/new" className="btn btn-primary">
          + Add product
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((tab) => {
          const isActive = (tab.key || '') === (category || '')
          return (
            <Link
              key={tab.key}
              href={buildHref({ category: tab.key, page: 1 })}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                isActive
                  ? 'bg-accent border-accent text-bg font-semibold'
                  : 'bg-surface border-border text-muted hover:border-accent hover:text-text'
              }`}
            >
              {tab.label} · {tab.count}
            </Link>
          )
        })}
      </div>

      <ProductSearch initialQuery={q} category={category} />

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Canonical name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">UOM</th>
                <th className="px-4 py-3 font-medium">Aliases</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted text-sm">
                    {q || category ? (
                      <>
                        No products match these filters.{' '}
                        <Link href="/products" className="text-accent hover:underline">
                          Clear filters
                        </Link>
                      </>
                    ) : (
                      <>
                        No products yet.{' '}
                        <Link href="/products/new" className="text-accent hover:underline">
                          Add your first product
                        </Link>{' '}
                        or run <span className="font-mono text-xs">npm run db:seed</span> to load sample data.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const totalStock = p.stock_levels.reduce((sum, s) => sum + s.qty, 0)
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
                      <td className="px-4 py-3 text-sm">
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
                      <td className="px-4 py-3 text-sm text-muted">{p.uom}</td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {p._count.aliases} {p._count.aliases === 1 ? 'alias' : 'aliases'}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {p.category === 'service' ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span className={totalStock > 0 ? 'text-teal' : 'text-muted'}>
                            {totalStock}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.is_active ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green/15 text-green">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface2 text-muted">
                            Inactive
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
