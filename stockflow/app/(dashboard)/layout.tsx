import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getTenantPrisma } from '@/lib/tenant-prisma';
import { Sidebar } from "@/components/Sidebar";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { getPackagingQueue } from '@/app/actions/packaging';

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login');

  const role = user.role;
  const sidebarCounts: { operatorQueue?: number; packagingQueue?: number } = {};

  if (role === 'OPERATOR') {
    const db = getTenantPrisma(user.organizationId);
    sidebarCounts.operatorQueue = await db.productionOrder.count({
      where: {
        status: 'IN_PRODUCTION',
      },
    });
  }

  if (role === 'PACKAGING') {
    sidebarCounts.packagingQueue = (await getPackagingQueue()).length;
  }

  if (role === 'PENDING') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h1 className="text-2xl font-bold">Account Under Review</h1>
        <p className="text-gray-500 mt-2">
          Welcome to StockFlow, {user.name}. Your account is pending approval from the Production Manager.
        </p>
        <p className="text-sm text-blue-600 mt-4">We will notify you once your role is assigned.</p>
        <form action="/api/auth/logout" method="post" className="mt-6">
          <button type="submit" className="btn btn-secondary">Logout</button>
        </form>
      </div>
    );
  }

  // 2. Security: If the user is on the wrong page, redirect them
  // This stops the "Permission Denied" flash by catching it before render
  return (
    <div className="app">
      <PresenceHeartbeat />
      <Sidebar role={role} counts={sidebarCounts} />
      <div className="main">
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
