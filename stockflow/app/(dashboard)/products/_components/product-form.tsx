'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS, PRODUCT_TYPES_BY_CATEGORY, PRODUCT_TYPE_LABELS } from '@/lib/products'
import type { ProductCategory, UOM } from '@prisma/client'

type Mode = 'create' | 'edit'

type Initial = {
  product_code?: string
  canonical_name?: string
  category?: ProductCategory
  product_type?: string
  uom?: UOM
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
    initial?.category ?? 'manufactured_spring'
  )

  const productTypes = PRODUCT_TYPES_BY_CATEGORY[category]
  const isSpring = category === 'manufactured_spring'
  const isUbolt = category === 'manufactured_ubolt'
  const isService = category === 'service'

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
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* CORE FIELDS */}
      <div className="card p-6">
        <div className="font-head font-bold mb-4">Core details</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Product code <span className="text-red">*</span>
            </label>
            <input
              name="product_code"
              required
              defaultValue={initial?.product_code ?? ''}
              className="input font-mono"
              placeholder="e.g. FH215/FSML"
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
              className="input"
              placeholder="e.g. Mitsubishi FH215 Front Spring Main Leaf"
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
              className="input"
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
              Product type <span className="text-red">*</span>
            </label>
            <select
              name="product_type"
              required
              defaultValue={initial?.product_type ?? productTypes[0]}
              key={category}
              className="input"
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
              defaultValue={initial?.uom ?? (isService ? 'pcs' : 'pcs')}
              className="input"
            >
              <option value="pcs">Pieces</option>
              <option value="set">Set</option>
              <option value="kg">Kilograms</option>
              <option value="litres">Litres</option>
              <option value="metres">Metres</option>
              <option value="box">Box</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs uppercase tracking-wider text-muted mb-2">
              Description
            </label>
            <input
              name="description"
              defaultValue={initial?.description ?? ''}
              className="input"
              placeholder="Optional notes about this product"
            />
          </div>
        </div>
      </div>

      {/* CATEGORY-SPECIFIC FIELDS */}
      {(isSpring || isUbolt) && (
        <div className="card p-6">
          <div className="font-head font-bold mb-4">
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
                className="input"
                placeholder="e.g. Mitsubishi FH 215"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                Vehicle model
              </label>
              <input
                name="vehicle_model"
                defaultValue={initial?.vehicle_model ?? ''}
                className="input"
                placeholder="e.g. FH215"
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
                    className="input"
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
                    className="input"
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
                    className="input"
                    placeholder="e.g. 24"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                    Leg length
                  </label>
                  <input
                    name="leg_length_inch"
                    defaultValue={initial?.leg_length_inch ?? ''}
                    className="input"
                    placeholder='e.g. 8"'
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PRICING */}
      <div className="card p-6">
        <div className="font-head font-bold mb-4">Pricing & reorder</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              className="input font-mono"
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
              className="input font-mono"
            />
          </div>
          {!isService && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted mb-2">
                Reorder point
              </label>
              <input
                  name="reorder_point"
                  type="number"
                  min="0"
                  defaultValue={initial?.reorder_point ?? ''}
                  className="input font-mono"
                  placeholder="Alert when stock < this"
                />
            </div>
          )}
        </div>
      </div>

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