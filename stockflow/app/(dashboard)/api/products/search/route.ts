import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''

  if (!query.trim()) {
    return NextResponse.json([])
  }

  const products = await db.product.findMany({
    where: {
      organizationId: user.organizationId,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
    },
    take: 10,
  })

  return NextResponse.json(products)
}