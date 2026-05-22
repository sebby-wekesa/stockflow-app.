'use client';

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductForm } from '@/app/(dashboard)/products/_components/product-form'
import { updateProduct } from '@/actions/products'

/* eslint-disable @typescript-eslint/no-explicit-any */

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
          <div className="section-sub">Update product details and settings</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {success ? (
        <div className="bg-teal-50 border-l-4 border-teal-400 p-4 mb-6">
          <p className="text-sm text-teal-800">
            Product updated successfully! Redirecting to product list...
          </p>
        </div>
      ) : (
        <div className="card">
          <ProductForm 
            mode="edit" 
            initial={initialForForm ?? product} 
            action={handleUpdate} 
          />
        </div>
      )}
    </div>
  )
}
