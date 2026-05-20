import { prisma } from '@/lib/prisma'
import { ProductForm } from '../_components/product-form'
import { notFound } from 'next/navigation'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      Branch: true,
    },
  })

  if (!product) {
    notFound()
  }

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Edit Product</div>
          <div className="section-sub">Update product details and settings</div>
        </div>
      </div>

      <div className="card">
        <ProductForm 
          mode="edit" 
          initial={product} 
        />
      </div>
    </div>
  )
}
