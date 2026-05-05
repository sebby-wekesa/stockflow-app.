import { createServerSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage() {
  const supabase = createServerSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  const user = await prisma.user.findUnique({
    where: { id: authUser!.id },
    include: { org: true },
  })

  // Health check counts — confirms the database is reachable
  const [productCount, userCount, branchStockCount] = await Promise.all([
    prisma.product.count(),
    prisma.user.count(),
    prisma.branchStock.count(),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-head text-2xl font-bold">
          Welcome, {user?.full_name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-muted text-sm mt-1">
          Phase 1 is live — auth and database are wired up. Next phase adds the product master.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Users</div>
          <div className="font-head text-3xl font-bold">{userCount}</div>
          <div className="text-xs text-muted mt-1">in the system</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Products</div>
          <div className="font-head text-3xl font-bold">{productCount}</div>
          <div className="text-xs text-muted mt-1">canonical SKUs · phase 2</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Stock records</div>
          <div className="font-head text-3xl font-bold">{branchStockCount}</div>
          <div className="text-xs text-muted mt-1">branch balances · phase 3</div>
        </div>
      </div>

      <div className="card p-6">
        <div className="font-head text-lg font-bold mb-3">System health</div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted">Authentication</span>
            <span className="text-teal-400">connected</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted">Database</span>
            <span className="text-teal-400">connected</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted">Organisation</span>
            <span>{user?.org.name}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted">Your role</span>
            <span className="capitalize">{user?.role}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 text-sm">
        <div className="font-medium text-purple-300 mb-1">Phase 2 — coming next</div>
        <div className="text-muted">
          Product master CRUD, alias management, and CSV seed of your 4,712 spring codes.
        </div>
      </div>
    </div>
  )
}
