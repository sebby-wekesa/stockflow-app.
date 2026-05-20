'use client';

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductForm } from '@/app/(dashboard)/products/_components/product-form'
import { updateProduct } from '@/actions/products'

interface Props {
  product: any
}

export default function EditProductClient({ product }: Props) {
  const router = useRouter()
  const [success, setSuccess] = useState(false)

  async function handleUpdate(formData: FormData) {
    try {
      await updateProduct(product.id, formData)
      setSuccess(true)
      setTimeout(() => {
        router.push('/products')
      }, 1500)
    } catch (err) {
      console.error('Failed to update product:', err)
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
            initial={product} 
            action={handleUpdate} 
          />
        </div>
      )}
    </div>
  )
}
