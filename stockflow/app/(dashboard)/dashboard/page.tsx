import { requireAuth } from '@/lib/auth'

import { TeamRole } from '@/lib/proxy'
import OperatorDashboard from '../operator/OperatorDashboard'
import WarehousePage from '../warehouse/page'
import AdminDashboard from '@/components/AdminDashboard'
import ManagerDashboard from '@/components/ManagerDashboard'
import SalesDashboard from '@/components/SalesDashboard'
import PackagingDashboard from '@/components/PackagingDashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireAuth();
  const role = user.role.toLowerCase() as TeamRole;
  return await TeamDashboard({ role, user });
}

// Pending Dashboard - Shows pending approval message
function PendingView({ user }: { user: any }) {
  return (
    <div className="space-y-8">
      <div className="card">
        <div className="text-center py-12">
          <div className="mx-auto mb-6 w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text mb-4">Account Pending Approval</h2>
          <p className="text-muted mb-6 max-w-md mx-auto">
            Your account has been created successfully and is waiting for administrator approval.
            You will receive access to the system once your account is approved.
          </p>
          <div className="bg-surface2 border border-border rounded-lg p-4 max-w-sm mx-auto">
            <div className="text-sm">
              <div className="font-medium text-text">Welcome, {user.name || user.email}!</div>
              <div className="text-muted mt-1">Role: Pending Approval</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// TeamDashboard component - switches views based on role
async function TeamDashboard({ role, user }: { role: TeamRole; user: any }) {
  switch (role) {
    case 'pending':
      return <PendingView user={user} />;
    case 'sales':
      return <SalesDashboard user={user} />;
    case 'packaging':
      return <PackagingDashboard />;
    case 'warehouse':
      return <WarehousePage />;
    case 'manager':
      return <ManagerDashboard />;
    case 'operator':
      return <OperatorDashboard />;
    case 'admin':
      return <AdminDashboard user={user} />;
    default:
      return <AdminDashboard user={user} />;
  }
}
