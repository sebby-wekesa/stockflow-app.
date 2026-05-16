'use client'

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const q = String(formData.get('q') || '').trim()
    const params = new URLSearchParams(searchParams)
    if (q) {
      params.set('q', q)
    } else {
      params.delete('q')
    }
    params.delete('page') // Reset to first page
    router.push(`/products?${params}`)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <input
        name="q"
        defaultValue={initialQuery}
        placeholder="Search by product code or name..."
        className="input max-w-md"
      />
    </form>
  )
}