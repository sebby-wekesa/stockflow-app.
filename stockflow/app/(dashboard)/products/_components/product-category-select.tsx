'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductCategory } from '@prisma/client'
import { updateProductCategory } from '@/actions/products'
import { CATEGORY_LABELS } from '@/lib/products'

type ProductCategorySelectProps = {
  productId: string
  category: ProductCategory
  canEdit: boolean
}

export function ProductCategorySelect({
  productId,
  category,
  canEdit,
}: ProductCategorySelectProps) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>(category)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!canEdit) {
    return <span>{CATEGORY_LABELS[category] ?? category}</span>
  }

  function handleChange(nextCategory: ProductCategory) {
    const previousCategory = selectedCategory
    setSelectedCategory(nextCategory)
    setError('')

    startTransition(async () => {
      try {
        await updateProductCategory(productId, nextCategory)
        router.refresh()
      } catch (err) {
        setSelectedCategory(previousCategory)
        setError(err instanceof Error ? err.message : 'Could not update category')
      }
    })
  }

  return (
    <div className="min-w-[150px]">
      <select
        aria-label="Product category"
        value={selectedCategory}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as ProductCategory)}
        className="form-input w-full py-1.5 text-xs"
      >
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {error && <div className="mt-1 text-xs text-red">{error}</div>}
    </div>
  )
}
