import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (productId) {
      // Fetch specific product with stock movements
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          StockMovement: {
            orderBy: { createdAt: 'desc' },
            take: 50, // Limit to recent movements
          },
        },
      })

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      return NextResponse.json(product)
    } else {
      // Fetch all products with basic info for selection
      const products = await prisma.product.findMany({
        where: {
          currentStock: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          currentStock: true,
          StockMovement: {
            orderBy: { createdAt: 'desc' },
            take: 10, // Just a few recent movements for preview
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