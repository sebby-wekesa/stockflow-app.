import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (productId) {
      // Fetch specific product with stock movements (tenant scoped)
      const product = await db.product.findUnique({
        where: { id: productId, organizationId: user.organizationId },
        include: {
          StockMovement: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      })

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      return NextResponse.json(product)
    } else {
      // Fetch all products with basic info for selection (tenant scoped)
      const products = await db.product.findMany({
        where: {
          currentStock: { gt: 0 },
          organizationId: user.organizationId,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          currentStock: true,
          StockMovement: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
        orderBy: { name: 'asc' },
      })

      return NextResponse.json(products)
    }
  } catch (error) {
    console.error('Stock ledger API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}