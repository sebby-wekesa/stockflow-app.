import { getUser } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { notFound, redirect } from 'next/navigation'
import EditProductClient from './EditProductClient'
import { normalizeBranchCode } from '@/lib/branches'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const db = getTenantPrisma(user.organizationId)

  // Tenant-scoped load (extension injects organizationId)
  const product = await db.product.findUnique({
    where: { id },
    include: { Branch: { select: { name: true, code: true, location: true } } },
  })

  if (!product) {
    notFound()
  }

  // Map DB shape (sku/name/unitCost/...) to the form's expected Initial shape (product_code/canonical_name/cost_price/...)
  const formInitial = {
    product_code: product.sku ?? '',
    canonical_name: product.name,
    category: product.category,
    origin: product.origin,
    uom: product.uom,
    cost_price: product.unitCost ?? null,
    reorder_point: product.reorderLevel ?? null,
    pieces_sets: product.piecesSets ?? 0,
    vendor: product.vendor ?? null,
    // extra optional fields the form may render in edit (populated if present on object)
    product_type: (product as any).product_type ?? null,
    description: (product as any).description ?? null,
    vehicle_make: (product as any).vehicle_make ?? null,
    vehicle_model: (product as any).vehicle_model ?? null,
    spring_position: (product as any).spring_position ?? null,
    leaf_position: (product as any).leaf_position ?? null,
    shaft_size_mm: (product as any).shaft_size_mm ?? null,
    leg_length_inch: (product as any).leg_length_inch ?? null,
    selling_price: (product as any).selling_price ?? null,
    currentStock: product.currentStock ?? null,
    branch: product.Branch
      ? normalizeBranchCode(product.Branch.code, product.Branch.name, product.Branch.location)
      : null,
  }

  return <EditProductClient product={product} initialForForm={formInitial} />
}
