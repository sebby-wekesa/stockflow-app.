import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RunwayAlerts } from "@/components/admin/RunwayAlerts";

async function getAdminStats() {
  const totalOrders = await prisma.productionOrder.count();
  const pendingOrders = await prisma.productionOrder.count({ where: { status: "PENDING" } });
  const inProduction = await prisma.productionOrder.count({ where: { status: "IN_PRODUCTION" } });
  const completed = await prisma.productionOrder.count({ where: { status: "COMPLETED" } });
  const designs = await prisma.design.count();
  const users = await prisma.user.count();
  const inventory = await prisma.rawMaterial.findMany();

  return { totalOrders, pendingOrders, inProduction, completed, designs, users, inventory };
}

export default async function AdminDashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
  });

  if (!dbUser || dbUser.role !== 'ADMIN') redirect("/login");

  const stats = await getAdminStats();

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Overview</div>
          <div className="section-sub">
            Welcome back, {user.name || user.email}
          </div>
        </div>
      </div>

      <RunwayAlerts inventory={stats.inventory} />
      <div className="grid-3 mb-6">
        <div className="stat-card amber">
          <div className="stat-label">Pending Approvals</div>
          <div className="stat-value">{stats.pendingOrders}</div>
          <Link href="/approvals" className="stat-sub hover:underline">
            View all pending orders →
          </Link>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Designs</div>
          <div className="stat-value">{stats.designs}</div>
          <Link href="/designs" className="stat-sub hover:underline">
            Manage design templates →
          </Link>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{stats.users}</div>
          <Link href="/users" className="stat-sub hover:underline">
            Manage users & roles →
          </Link>
        </div>
      </div>
      <div className="stats-grid">
        <StatCard label="Total Orders" value={stats.totalOrders} />
        <StatCard label="In Production" value={stats.inProduction} color="purple" />
        <StatCard label="Completed" value={stats.completed} color="green" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "" }: { label: string; value: number; color?: "" | "amber" | "teal" | "purple" | "red" | "green" }) {
  // Mockup CSS mapping
  const colorMap: Record<string, string> = {
    "": "",
    "amber": "amber",
    "teal": "teal",
    "purple": "purple",
    "red": "red",
    "green": "teal", // green bar not explicitly defined in css::before, using teal or just plain
  };
  return (
    <div className={`stat-card ${colorMap[color] || ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}