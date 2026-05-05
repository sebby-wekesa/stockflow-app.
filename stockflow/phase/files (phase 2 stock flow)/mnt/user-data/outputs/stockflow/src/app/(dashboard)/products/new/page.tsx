import Link from 'next/link'
import { ProductForm } from '../_components/product-form'
import { createProduct } from '../actions'

export default function NewProductPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href="/products" className="text-sm text-muted hover:text-text">
          ← Back to products
        </Link>
        <h1 className="font-head text-2xl font-bold mt-2">Add product</h1>
        <p className="text-muted text-sm mt-1">
          Create a canonical product entry. The canonical name is automatically saved as the first alias.
        </p>
      </div>

      <ProductForm mode="create" action={createProduct} />
    </div>
  )
}
