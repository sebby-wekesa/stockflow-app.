import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/lib/branches'
import { TransferForm } from '@/components/stock/TransferForm'
import type { BranchCode as Branch } from '@/lib/branches'

export const dynamic = 'force-dynamic';

export default async function TransferPage() {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  // Get user branches based on role or permissions
  const userBranches = user.role === 'admin'
    ? ALL_BRANCHES
    : ['mombasa', 'nairobi', 'bonje'] as Branch[] // For now, assume all branches

  // Get products with stock in any branch
  const productsWithStock = await prisma.product.findMany({
    where: {
      category: { not: 'service' }, // Exclude service products from transfers
      stock_levels: {
        some: { qty: { gt: 0 } }
      }
    },
    include: {
      stock_levels: true
    },
    orderBy: { sku: 'asc' }
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/stock" className="text-sm text-muted hover:text-text">
          ← Back to stock overview
        </Link>
        <h1 className="font-head text-2xl font-bold mt-2">Transfer stock</h1>
        <p className="text-muted text-sm mt-1">
          Move finished goods between branches
        </p>
      </div>

      <TransferForm
        products={productsWithStock}
        userBranches={userBranches}
      />
    </div>
  )
}