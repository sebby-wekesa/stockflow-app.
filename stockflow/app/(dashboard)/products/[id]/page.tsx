import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { branchStocks: true, saleOrderLines: { take: 10, orderBy: { createdAt: 'desc' } } },
  })
  if (!product) notFound()

  const totalStock = product.branchStocks.reduce((sum, s) => sum + s.qty, 0)
  return (
    <div className="max-w-4xl">
      <Link href="/products" className="text-sm text-muted hover:text-text">← Back to products</Link>
      <h1 className="font-head text-2xl font-bold mt-2">{product.name}</h1>
      <p className="text-muted text-sm mt-1 font-mono">{product.code}</p>

      <div className="grid grid-cols-4 gap-3 my-6">
        <div className="card p-4"><div className="text-xs text-muted">Category</div><div className="font-medium mt-1">{product.category}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">UOM</div><div className="font-medium mt-1">{product.uom ?? '—'}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Total stock</div><div className="font-medium mt-1">{totalStock}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Selling price</div><div className="font-medium mt-1">{product.sellingPrice}</div></div>
      </div>

      <div className="card p-4">
        <h2 className="font-head font-bold mb-3">Branch stock</h2>
        <div className="space-y-2">
          {product.branchStocks.map((s) => (
            <div key={s.id} className="flex justify-between text-sm"><span className="capitalize">{s.branch}</span><span className="font-mono">{s.qty}</span></div>
          ))}
          {product.branchStocks.length === 0 && <div className="text-sm text-muted">No branch stock records yet.</div>}
        </div>
      </div>
    </div>
  )
}
