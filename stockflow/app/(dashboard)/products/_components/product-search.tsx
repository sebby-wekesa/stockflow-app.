'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductCategory } from '@prisma/client'

interface ProductSearchProps {
  initialQuery: string
  category?: ProductCategory
}

export function ProductSearch({ initialQuery, category }: ProductSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category) params.set('category', category)
    router.push(`/products?${params}`)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products by code or name..."
          className="input flex-1"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </div>
    </form>
  )
}