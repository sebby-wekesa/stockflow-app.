import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { BRANCH_LABELS, BRANCH_ACCENT_CLASS, BRANCH_TEXT_CLASS, formatKES } from '@/lib/branches'
import { TransferButton } from '@/components/transfer-button'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function StockPage({
  searchParams,
}: {
  searchParams: { branch?: string; category?: string; q?: string; page?: string }
}) {
  const branch = searchParams.branch as 'mombasa' | 'nairobi' | 'bonje' | undefined
  const category = searchParams.category
  const q = searchParams.q?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))

  const where: any = { isService: false }
  if (branch) where.branchStocks = { some: { branch } }
  if (category) where.category = category
  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [products, total, branchSummaries] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        branchStocks: true,
      },
      orderBy: { code: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.product.count({ where }),
    prisma.branchStock.groupBy({
      by: ['branch'],
      _count: { productId: true },
      _sum: { qty: true },
      where: { product: { isService: false } },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const branchStats = branchSummaries.map(s => ({
    branch: s.branch,
    skus: s._count.productId,
    units: s._sum.qty ?? 0,
    value: products.filter(p => p.branchStocks.some(bs => bs.branch === s.branch)).reduce((sum, p) => sum + (p.sellingPrice * (p.branchStocks.find(bs => bs.branch === s.branch)?.qty ?? 0)), 0),
    lowStock: products.filter(p => p.branchStocks.some(bs => bs.branch === s.branch && bs.qty <= p.reorderPoint)).length,
  }))

  return (
    <div>
      <div className="section-header mb-16">
        <h1 className="section-title">Stock Overview</h1>
        <TransferButton />
      </div>

      <div className="stats-grid mb-16">
        {branchStats.map(stat => (
          <Link key={stat.branch} href={`/stock?branch=${stat.branch}`} className={`stat-card ${BRANCH_ACCENT_CLASS[stat.branch]}`}>
            <div className="stat-label">{BRANCH_LABELS[stat.branch]}</div>
            <div className="stat-value">{stat.skus}</div>
            <div className="stat-sub">{stat.units} units · {formatKES(stat.value)}</div>
            {stat.lowStock > 0 && <div className="stat-sub text-red-400">{stat.lowStock} low stock</div>}
          </Link>
        ))}
      </div>

      {/* Category filters can be added here */}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Mombasa</th>
              <th>Nairobi</th>
              <th>Bonje</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => {
              const totalQty = product.branchStocks.reduce((sum, bs) => sum + bs.qty, 0)
              return (
                <tr key={product.id}>
                  <td><Link href={`/products/${product.id}`} className="text-blue-400">{product.code}</Link></td>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{product.branchStocks.find(bs => bs.branch === 'mombasa')?.qty ?? 0}</td>
                  <td>{product.branchStocks.find(bs => bs.branch === 'nairobi')?.qty ?? 0}</td>
                  <td>{product.branchStocks.find(bs => bs.branch === 'bonje')?.qty ?? 0}</td>
                  <td className={totalQty <= product.reorderPoint ? 'text-red-400' : ''}>{totalQty}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}