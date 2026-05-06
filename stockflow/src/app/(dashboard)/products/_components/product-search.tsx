'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ProductCategory } from '@prisma/client'

export function ProductSearch({
  initialQuery,
  category,
}: {
  initialQuery: string
  category?: ProductCategory
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (query.trim()) {
      params.set('q', query.trim())
    } else {
      params.delete('q')
    }
    if (category) {
      params.set('category', category)
    }
    params.delete('page') // Reset to page 1
    router.push(`/products?${params.toString()}`)
  }

  function handleClear() {
    setQuery('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    params.delete('page')
    if (category) {
      params.set('category', category)
    }
    router.push(`/products?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by code or name..."
        className="input flex-1"
      />
      <button type="submit" className="btn btn-ghost">
        Search
      </button>
      {query && (
        <button type="button" onClick={handleClear} className="btn btn-ghost">
          Clear
        </button>
      )}
    </form>
  )
}