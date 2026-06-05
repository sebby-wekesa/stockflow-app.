'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS, ORIGIN_LABELS, PRODUCT_TYPES_BY_CATEGORY, PRODUCT_TYPE_LABELS, PRODUCT_UOM_LABELS, PRODUCT_UOMS, normalizeProductUom } from '@/lib/products'
import type { ProductCategory, StockOrigin } from '@prisma/client'
import { ALL_BRANCHES, BRANCH_LABELS, type BranchCode } from '@/lib/branches'

type Mode = 'create' | 'edit'

type Initial = {
  product_code?: string
  canonical_name?: string
  category?: ProductCategory
  origin?: StockOrigin
  product_type?: string
  uom?: string
  description?: string | null
  vehicle_make?: string | null
  vehicle_model?: string | null
  spring_position?: string | null
  leaf_position?: string | null
  shaft_size_mm?: number | null
  leg_length_inch?: string | null
  cost_price?: number | null
  selling_price?: number | null
  reorder_point?: number | null
  pieces_sets?: number | null
  currentStock?: number | null
  branch?: BranchCode | null
}

export function ProductForm({
  mode,
  initial,
  action,
}: {
  mode: Mode
  initial?: Initial
  action: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<ProductCategory>(
    initial?.category ?? 'springs'
  )

  const productTypes = PRODUCT_TYPES_BY_CATEGORY[category]
  const isSpring = category === 'springs'
  const isUbolt = category === 'ubolts' || category === 'center_bolts'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await action(formData)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-md bg-red/10 border border-red/30 text-red text-sm">
          {error}
        </div>
      )}

      {/* CORE FIELDS */}
      <div className="card p-6">
        <div className="section-title mb-16">Core details</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Product code <span className="text-red">*</span>
            </label>
            <input
              name="product_code"
              required
              defaultValue={initial?.product_code ?? ''}
              className="form-input w-full font-mono"
              placeholder="Product code"
            />
            <p className="text-xs text-muted mt-1">
              Unique permanent identifier. Cannot be reused if deleted.
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Canonical name <span className="text-red">*</span>
            </label>
            <input
              name="canonical_name"
              required
              defaultValue={initial?.canonical_name ?? ''}
              className="form-input w-full"
              placeholder="Canonical product name"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Category <span className="text-red">*</span>
            </label>
            <select
              name="category"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="form-input w-full"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Origin <span className="text-red">*</span>
            </label>
            <select
              name="origin"
              required
              defaultValue={initial?.origin ?? 'FACTORY_MADE'}
              className="form-input w-full"
            >
              {Object.entries(ORIGIN_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Product type <span className="text-red">*</span>
            </label>
            <select
              name="product_type"
              required
              defaultValue={initial?.product_type ?? productTypes[0]}
              key={category}
              className="form-input w-full"
            >
              {productTypes.map((t) => (
                <option key={t} value={t}>
                  {PRODUCT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Unit of measure <span className="text-red">*</span>
            </label>
            <select
              name="uom"
              required
              defaultValue={normalizeProductUom(initial?.uom) ?? 'KG'}
              className="form-input w-full"
            >
              {PRODUCT_UOMS.map((uom) => (
                <option key={uom} value={uom}>
                  {PRODUCT_UOM_LABELS[uom]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Branch <span className="text-red">*</span>
            </label>
            <select
              name="branch"
              required
              defaultValue={initial?.branch ?? ''}
              className="form-input w-full"
            >
              <option value="" disabled>Select branch</option>
              {ALL_BRANCHES.map((branch) => (
                <option key={branch} value={branch}>
                  {BRANCH_LABELS[branch]}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Description
            </label>
            <input
              name="description"
              defaultValue={initial?.description ?? ''}
              className="form-input w-full"
              placeholder="Optional notes about this product"
            />
          </div>
        </div>
      </div>

      {/* CATEGORY-SPECIFIC FIELDS */}
      {(isSpring || isUbolt) && (
        <div className="card p-6">
          <div className="section-title mb-16">
            {isSpring ? 'Vehicle & spring details' : 'U-bolt specifications'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                Vehicle make
              </label>
              <input
                name="vehicle_make"
                defaultValue={initial?.vehicle_make ?? ''}
                className="form-input w-full"
                placeholder="Vehicle make"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                Vehicle model
              </label>
              <input
                name="vehicle_model"
                defaultValue={initial?.vehicle_model ?? ''}
                className="form-input w-full"
                placeholder="Vehicle model"
              />
            </div>

            {isSpring && (
              <>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                    Spring position
                  </label>
                  <select
                    name="spring_position"
                    defaultValue={initial?.spring_position ?? ''}
                    className="form-input w-full"
                  >
                    <option value="">— select —</option>
                    <option value="Front">Front</option>
                    <option value="Rear">Rear</option>
                    <option value="Helper">Helper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                    Leaf position
                  </label>
                  <select
                    name="leaf_position"
                    defaultValue={initial?.leaf_position ?? ''}
                    className="form-input w-full"
                  >
                    <option value="">— select —</option>
                    <option value="Main Leaf">Main leaf</option>
                    <option value="2nd Leaf">2nd leaf</option>
                    <option value="3rd Leaf">3rd leaf</option>
                    <option value="4th Leaf">4th leaf</option>
                    <option value="Auxiliary">Auxiliary</option>
                  </select>
                </div>
              </>
            )}

            {isUbolt && (
              <>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                    Shaft size (mm)
                  </label>
                  <input
                    name="shaft_size_mm"
                    type="number"
                    min="0"
                    defaultValue={initial?.shaft_size_mm ?? ''}
                    className="form-input w-full"
                    placeholder="Shaft size"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                    Leg length
                  </label>
                  <input
                    name="leg_length_inch"
                    defaultValue={initial?.leg_length_inch ?? ''}
                    className="form-input w-full"
                    placeholder="Leg length"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PRICING */}
      <div className="card p-6">
        <div className="section-title mb-16">Pricing & reorder</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Cost price (KES)
            </label>
            <input
              name="cost_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initial?.cost_price ?? ''}
              className="form-input w-full font-mono"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Selling price (KES)
            </label>
            <input
              name="selling_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initial?.selling_price ?? ''}
              className="form-input w-full font-mono"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Reorder point
            </label>
            <input
              name="reorder_point"
              type="number"
              min="0"
              defaultValue={initial?.reorder_point ?? ''}
              className="form-input w-full font-mono"
              placeholder="Alert when stock < this"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              PCS/Sets
            </label>
            <input
              name="pieces_sets"
              type="number"
              min="0"
              step="1"
              defaultValue={initial?.pieces_sets ?? 0}
              className="form-input w-full font-mono"
            />
          </div>
        </div>
      </div>

      {mode === 'edit' && (
        <div className="card p-6" style={{ borderColor: 'rgba(240,192,64,0.45)' }}>
          <div className="section-title mb-6" style={{ color: 'var(--accent)' }}>Stock Adjustment</div>
          <div className="text-sm text-muted mb-4">
            Changing stock here creates an adjustment record. Prefer using receipts or production for normal changes.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                Current Stock
              </label>
              <input
                name="current_stock"
                type="number"
                step="0.01"
                defaultValue={initial?.currentStock ?? 0}
                className="form-input w-full font-mono"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                Reason for adjustment
              </label>
              <input
                name="adjustment_reason"
                type="text"
                placeholder="Required only when stock changes"
                className="form-input w-full"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={isPending} className="btn btn-primary">
          {isPending ? 'Saving...' : mode === 'create' ? 'Create product' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-ghost"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
