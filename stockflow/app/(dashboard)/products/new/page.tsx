import { createProduct } from '../actions'
import { ProductForm } from '../_components/product-form'

export default function NewProductPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-head text-2xl font-bold">Add new product</h1>
        <p className="text-muted text-sm mt-1">
          Create a canonical product with pricing and specifications.
        </p>
      </div>

      <ProductForm mode="create" action={createProduct} />
    </div>
  )
}