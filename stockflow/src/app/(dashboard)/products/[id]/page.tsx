import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CATEGORY_BADGE_CLASS, CATEGORY_SHORT, PRODUCT_TYPE_LABELS } from '@/lib/products'
import { ProductForm } from '../_components/product-form'
import { AliasManager } from '../_components/alias-manager'
import { DangerZone } from '../_components/danger-zone'
import { updateProduct } from '../actions'

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      aliases: { orderBy: { created_at: 'asc' } },
      stock_levels: true,
      _count: {
        select: {
          stock_movements: true,
          sales_order_lines: true,
          job_cards: true,
        },
      },
    },
  })

  if (!product) notFound()

  const totalStock = product.stock_levels.reduce((sum, s) => sum + s.qty, 0)
  const stockByBranch = Object.fromEntries(
    product.stock_levels.map((s) => [s.branch, s.qty])
  )

  // Bind productId into the update action so the form can call it directly
  const updateAction = updateProduct.bind(null, product.id)

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link href="/products" className="text-sm text-muted hover:text-text">
          ← Back to products
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-head text-2xl font-bold font-mono">{product.product_code}</h1>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  CATEGORY_BADGE_CLASS[product.category]
                }`}
              >
                {CATEGORY_SHORT[product.category]}
              </span>
              {!product.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface2 text-muted">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-muted text-sm mt-1">{product.canonical_name}</p>
          </div>
        </div>
      </div>

      {/* SUMMARY GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Type</div>
          <div className="text-sm font-medium">{PRODUCT_TYPE_LABELS[product.product_type]}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">UOM</div>
          <div className="text-sm font-medium">{product.uom}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Total stock</div>
          <div className="font-mono text-lg font-medium">
            {product.category === 'service' ? (
              <span className="text-muted">—</span>
            ) : (
              <span className={totalStock > 0 ? 'text-teal' : 'text-muted'}>{totalStock}</span>
            )}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Aliases</div>
          <div className="text-lg font-medium">{product.aliases.length}</div>
        </div>
      </div>

      {/* STOCK BY BRANCH */}
      {product.category !== 'service' && (
        <div className="card p-5 mb-6">
          <div className="font-head font-bold text-sm mb-3">Stock by branch</div>
          <div className="grid grid-cols-3 gap-3">
            {(['mombasa', 'nairobi', 'bonje'] as const).map((branch) => (
              <div
                key={branch}
                className="bg-surface2 rounded-md p-3 flex items-center justify-between"
              >
                <span className="text-sm capitalize text-muted">{branch}</span>
                <span className="font-mono font-medium">{stockByBranch[branch] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALIAS MANAGEMENT */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-head font-bold">Aliases</div>
            <p className="text-xs text-muted mt-1">
              Every name variant that should resolve to this product. Imports use these for
              automatic matching.
            </p>
          </div>
        </div>
        <AliasManager productId={product.id} aliases={product.aliases} />
      </div>

      {/* EDIT FORM */}
      <div className="mb-6">
        <h2 className="font-head font-bold text-lg mb-3">Edit details</h2>
        <ProductForm
          mode="edit"
          initial={{
            product_code: product.product_code,
            canonical_name: product.canonical_name,
            category: product.category,
            product_type: product.product_type,
            uom: product.uom,
            description: product.description,
            vehicle_make: product.vehicle_make,
            vehicle_model: product.vehicle_model,
            spring_position: product.spring_position,
            leaf_position: product.leaf_position,
            shaft_size_mm: product.shaft_size_mm,
            leg_length_inch: product.leg_length_inch,
            cost_price: product.cost_price ? Number(product.cost_price) : null,
            selling_price: product.selling_price ? Number(product.selling_price) : null,
            reorder_point: product.reorder_point,
          }}
          action={updateAction}
        />
      </div>

      {/* DANGER ZONE */}
      <DangerZone
        productId={product.id}
        isActive={product.is_active}
        usageCount={
          product._count.stock_movements +
          product._count.sales_order_lines +
          product._count.job_cards
        }
      />
    </div>
  )
}