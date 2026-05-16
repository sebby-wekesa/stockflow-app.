export const dynamic = 'force-dynamic';

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";


async function getAdminStats() {
  const totalOrders = await prisma.productionOrder.count();
  const pendingOrders = await prisma.productionOrder.count({ where: { status: "PENDING" } });
  const inProduction = await prisma.productionOrder.count({ where: { status: "IN_PRODUCTION" } });
  const completed = await prisma.productionOrder.count({ where: { status: "COMPLETED" } });
  const designs = await prisma.design.count();

  // Count users from Prisma User table
  const users = await prisma.user.count();

  const inventory = await prisma.rawMaterial.findMany();

  // Calculate dashboard stats
  const rawMaterialStock = inventory.reduce(
    (sum, m) => sum + (m.availableKg?.toNumber() ?? 0) + (m.reservedKg?.toNumber() ?? 0),
    0
  );
  const totalFree = inventory.reduce(
    (sum, m) => sum + (m.availableKg?.toNumber() ?? 0),
    0
  );

  const activeOrdersCount = await prisma.productionOrder.count({
    where: { status: { in: ["APPROVED", "IN_PRODUCTION"] } },
  });
  const pendingApprovalsCount = pendingOrders;

  const finishedGoodsAgg = await prisma.finishedGoods.aggregate({
    _sum: {
      kgProduced: true,
      quantity: true,
    },
  });
  const finishedGoods = {
    _sum: {
      kgProduced: finishedGoodsAgg._sum.kgProduced?.toNumber() ?? 0,
      quantity: finishedGoodsAgg._sum.quantity ?? 0,
    }
  };

  // Scrap this week calculation (simplified)
  const scrapThisWeek = 0; // Would need more complex query

  // Recent orders
  const recentOrders = await prisma.productionOrder.findMany({
    take: 4,
    where: {},
    orderBy: { createdAt: "desc" },
    include: { Design: true },
  });

  // Department scrap (simplified)
  const departmentScrap = []; // Would need complex aggregation

  // Throughput (simplified)
  const throughput = []; // Would need complex aggregation

  return {
    totalOrders,
    pendingOrders,
    inProduction,
    completed,
    designs,
    users,
    inventory,
    rawMaterialStock,
    totalFree,
    activeOrdersCount,
    pendingApprovalsCount,
    finishedGoods,
    scrapThisWeek,
    recentOrders: recentOrders.map(o => ({
      id: o.orderNumber,
      design: o.Design.name,
      kg: o.targetKg?.toNumber() ?? 0,
      status: o.status === "PENDING" ? "Pending approval" :
              o.status === "APPROVED" || o.status === "IN_PRODUCTION" ? "In production" : "Complete",
      dept: o.currentDept,
    })),
    departmentScrap,
    throughput,
  };
}

export default async function AdminDashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/unauthorized");

  const stats = await getAdminStats();

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Overview</div><div className="section-sub">Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div></div>
        <Link href="/orders/new" className="btn btn-primary">+ New production order</Link>
      </div>
      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-label">Raw material stock</div>
          <div className="stat-value">{stats.rawMaterialStock.toFixed(0)}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
          <div className="stat-sub">{inventory.length} materials · <span>+200 kg today</span></div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Active production orders</div>
          <div className="stat-value">{stats.activeOrdersCount}</div>
          <div className="stat-sub">{stats.pendingOrders} pending approval · <span>{stats.inProduction} in production</span></div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Finished goods ready</div>
          <div className="stat-value">{stats.finishedGoods._sum.kgProduced.toFixed(0)}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
          <div className="stat-sub"><span>{stats.finishedGoods._sum.quantity}</span> units across {stats.designs} designs</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Scrap this week</div>
          <div className="stat-value">{stats.scrapThisWeek}</div>
          <div className="stat-sub"><span className="down">↑ 12 kg</span> vs last week</div>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="section-header mb-16"><div className="section-title">Recent production orders</div><Link href="/orders" className="btn btn-ghost btn-sm">View all</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Design</th><th>Kg reserved</th><th>Status</th><th>Dept</th></tr></thead>
              <tbody>
                {stats.recentOrders.slice(0, 4).map((order) => (
                  <tr key={order.id}>
                    <td><span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>{order.id}</span></td>
                    <td>{order.design}</td>
                    <td><span className="job-kg">{order.kg} kg</span></td>
                    <td><span className={`badge ${order.status === 'In production' ? 'badge-purple' : order.status === 'Pending approval' ? 'badge-amber' : order.status === 'Complete' ? 'badge-green' : 'badge-muted'}`}>{order.status}</span></td>
                    <td>{order.dept || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="section-header mb-16"><div className="section-title">Scrap by department</div><div style={{fontSize:'11px',color:'var(--muted)'}}>This week</div></div>
          {/* Placeholder for department scrap - would need actual data */}
          {['Cutting','Forging','Threading','Electroplating','Drilling'].map((d,i) => {
            const vals = [8,22,5,31,16]; const pcts = [4,11,2,15,8];
            const cls = pcts[i] > 10 ? 'bad' : pcts[i] > 5 ? 'warn' : 'good';
            return `<div class="scrap-bar-wrap"><div class="scrap-bar-label"><span>${d}</span><span>${vals[i]} kg · ${pcts[i]}%</span></div><div class="scrap-bar"><div class="scrap-bar-fill ${cls}" style="width:${pcts[i]*4}%"></div></div></div>`;
          }).join('')}
        </div>
      </div>
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Department throughput — today</div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Department</th><th>Jobs active</th><th>Kg processed</th><th>Kg scrap</th><th>Yield</th><th>Operators</th></tr></thead>
            <tbody>
              <tr><td>Cutting</td><td>3</td><td><span className="job-kg">340 kg</span></td><td>14 kg</td><td><span className="badge badge-green">95.9%</span></td><td>2</td></tr>
              <tr><td>Forging / chamfer</td><td>2</td><td><span className="job-kg">180 kg</span></td><td>22 kg</td><td><span className="badge badge-amber">87.8%</span></td><td>2</td></tr>
              <tr><td>Threading / locking</td><td>4</td><td><span className="job-kg">210 kg</span></td><td>5 kg</td><td><span className="badge badge-green">97.6%</span></td><td>3</td></tr>
              <tr><td>Electroplating</td><td>1</td><td><span className="job-kg">95 kg</span></td><td>31 kg</td><td><span className="badge badge-red">67.4%</span></td><td>1</td></tr>
              <tr><td>Drilling / grinding</td><td>2</td><td><span className="job-kg">120 kg</span></td><td>10 kg</td><td><span className="badge badge-green">91.7%</span></td><td>2</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


