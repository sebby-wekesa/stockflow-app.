import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { SalesForm } from '../_components/sales-form'
import type { Branch } from '@prisma/client'

export default async function NewSalesOrderPage() {
  const supabase = createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) redirect('/login')

  // Determine which branches this user can sell from
  const allowedBranches: Branch[] =
    user.role === 'admin' ? ['mombasa', 'nairobi', 'bonje'] : user.branches

  if (allowedBranches.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-muted">
          You don't have access to any branches. Ask your admin to assign you to one.
        </p>
      </div>
    )
  }

  // Default branch: first allowed
  const defaultBranch = allowedBranches[0]

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link href="/sales" className="text-sm text-muted hover:text-text">
          ← Back to sales
        </Link>
        <h1 className="font-head text-2xl font-bold mt-2">New sale</h1>
        <p className="text-muted text-sm mt-1">
          Record a sale with multiple line items. Stock decrements automatically when invoiced.
        </p>
      </div>

      <SalesForm allowedBranches={allowedBranches} defaultBranch={defaultBranch} />
    </div>
  )
}
