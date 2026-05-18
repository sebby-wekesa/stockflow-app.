'use client';

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductForm } from '@/app/(dashboard)/products/_components/product-form'
import { createProduct } from '@/actions/products'

export default function NewProductPage() {
  const router = useRouter()
  const [success, setSuccess] = useState(false)

  async function handleCreate(formData: FormData) {
    try {
      await createProduct(formData)
      setSuccess(true)
      // Redirect to products list after a short delay
      setTimeout(() => {
        router.push('/products')
      }, 1500)
    } catch (err) {
      // Error will be shown by the ProductForm component
      console.error('Failed to create product:', err)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-head text-2xl font-bold mt-2">New Product</h1>
        <p className="text-muted text-sm mt-1">
          Add a new product to the inventory
        </p>
      </div>

      {success ? (
        <div className="bg-teal-50 border-l-4 border-teal-400 p-4 mb-6">
          <p className="text-sm text-teal-800">
            Product created successfully! Redirecting to product list...
          </p>
        </div>
      ) : (
        <>
          <ProductForm
            mode="create"
            action={handleCreate}
          />
        </>
      )}
    </div>
  )
}