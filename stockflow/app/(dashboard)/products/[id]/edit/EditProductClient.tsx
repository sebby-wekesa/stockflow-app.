'use client';

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ProductForm } from '@/app/(dashboard)/products/_components/product-form'
import { updateProduct } from '@/actions/products'

interface Props {
  product: any
  initialForForm?: any
}

export default function EditProductClient({ product, initialForForm }: Props) {
  const router = useRouter()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpdate(formData: FormData) {
    setError(null)
    try {
      await updateProduct(product.id, formData)
      setSuccess(true)
      setTimeout(() => {
        router.push('/products')
      }, 1500)
    } catch (err) {
      const msg = (err as Error).message || 'Update failed'
      console.error('Failed to update product:', err)
      setError(msg)
      // Re-throw so the inner ProductForm's error handler can also catch if needed
      throw err
    }
  }

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Edit Product</div>
          <div className="section-sub">
            {product.sku || product.id.slice(0, 8)} · {product.name}
          </div>
        </div>
        <Link href="/products" className="btn btn-ghost">
          Back to products
        </Link>
      </div>

      {error && (
        <div className="mb-16 p-3 rounded-md bg-red/10 border border-red/30 text-red text-sm">
          {error}
        </div>
      )}

      {success ? (
        <div className="mb-16 p-3 rounded-md bg-teal/10 border border-teal/30 text-teal text-sm">
          <p>
            Product updated successfully! Redirecting to product list...
          </p>
        </div>
      ) : (
        <ProductForm
          mode="edit"
          initial={initialForForm ?? product}
          action={handleUpdate}
        />
      )}
    </div>
  )
}
