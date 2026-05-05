import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { SalesForm } from '../_components/sales-form'
import type { BranchEnum } from '@prisma/client'

export default async function NewSalesOrderPage() {
  const supabase = await createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) redirect('/login')

  const allowedBranches: BranchEnum[] = user.role === 'ADMIN'
    ? ['mombasa', 'nairobi', 'bonje']
    : user.branchId
      ? [(await prisma.branch.findUnique({ where: { id: user.branchId }, select: { branch: true } }))?.branch ?? 'mombasa']
      : ['mombasa']

  return (
    <div className="max-w-5xl">
      <h1 className="font-head text-2xl font-bold mb-6">New sale</h1>
      <SalesForm allowedBranches={allowedBranches} defaultBranch={allowedBranches[0]} />
    </div>
  )
}
