export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getUser } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

interface ScrapByDept {
  dept: string;
  kg: number;
  pct: number;
}

interface DeptThroughput {
  department: string;
  jobsActive: number;
  kgProcessed: number;
  kgScrap: number;
  yield: number;
  operators: number;
}

interface RecentOrder {
  id: string;
  design: string;
  kg: number;
  status: string;
  dept: string | null;
}

interface AdminStats {
  totalOrders: number;
  pendingOrders: number;
  inProduction: number;
  completed: number;
  designs: number;
  users: number;
  inventory: any[];
  rawMaterialStock: number;
  totalFree: number;
  activeOrdersCount: number;
  pendingApprovalsCount: number;
  finishedGoods: { _sum: { kgProduced: number; quantity: number } };
  scrapThisWeek: number;
  scrapByDept: ScrapByDept[];
  departmentThroughput: DeptThroughput[];
  recentOrders: RecentOrder[];
}


async function getAdminStats(db: any): Promise<AdminStats> {
  const totalOrders = await db.productionOrder.count();
  const pendingOrders = await db.productionOrder.count({ where: { status: "PENDING" } });
  const inProduction = await db.productionOrder.count({ where: { status: "IN_PRODUCTION" } });
  const completed = await db.productionOrder.count({ where: { status: "COMPLETED" } });
  const designs = await db.design.count();

  // Count users from Prisma User table
  const users = await db.user.count();

  const inventory = await db.rawMaterial.findMany();

  // Calculate dashboard stats
  const rawMaterialStock = inventory.reduce(
    (sum: number, m: any) => sum + (m.availableKg?.toNumber() ?? 0) + (m.reservedKg?.toNumber() ?? 0),
    0
  );
  const totalFree = inventory.reduce(
    (sum: number, m: any) => sum + (m.availableKg?.toNumber() ?? 0),
    0
  );

  const activeOrdersCount = await db.productionOrder.count({
    where: { status: { in: ["APPROVED", "IN_PRODUCTION"] } },
  });
  const pendingApprovalsCount = pendingOrders;

  const finishedGoodsAgg = await db.finishedGoods.aggregate({
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

  // ── Real data for previously hardcoded sections ──────────────────────────────
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Scrap this week (from StageLog)
  const scrapWeekAgg = await db.stageLog.aggregate({
    _sum: { kgScrap: true },
    where: { completedAt: { gte: oneWeekAgo } },
  });
  const scrapThisWeek = scrapWeekAgg._sum.kgScrap?.toNumber() ?? 0;

  // Scrap by department this week
  const scrapDeptRaw = await db.stageLog.groupBy({
    by: ['department'],
    _sum: { kgScrap: true },
    where: {
      completedAt: { gte: oneWeekAgo },
      department: { not: null },
    },
    orderBy: { _sum: { kgScrap: 'desc' } },
  });
  const totalScrapForPct = scrapDeptRaw.reduce((s: number, r: any) => s + (r._sum.kgScrap?.toNumber() ?? 0), 0) || 1;
  const scrapByDept = scrapDeptRaw.map((r: any) => {
    const kg = r._sum.kgScrap?.toNumber() ?? 0;
    const pct = Math.round((kg / totalScrapForPct) * 100);
    return { dept: r.department!, kg, pct };
  });

  // Department throughput for today (from StageLog + active ProductionOrders)
  const knownDepts = ['Cutting', 'Forging / chamfer', 'Threading / locking', 'Electroplating', 'Drilling / grinding'];

  const activeByDeptRaw = await db.productionOrder.groupBy({
    by: ['currentDept'],
    _count: { _all: true },
    where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] }, currentDept: { not: null } },
  });
  const activeMap = new Map(activeByDeptRaw.map((a: any) => [ (a.currentDept || '').toLowerCase(), a._count._all ]));

  // Fetch today's logs to compute distinct operators + aggregates per dept
  const todayLogs = await db.stageLog.findMany({
    where: { completedAt: { gte: todayStart }, department: { not: null } },
    select: { department: true, operatorId: true, kgIn: true, kgOut: true, kgScrap: true },
  });

  const deptToday = new Map<string, { kgIn: number; kgOut: number; kgScrap: number; ops: Set<string> }>();
  for (const log of todayLogs) {
    const d = log.department!;
    if (!deptToday.has(d)) deptToday.set(d, { kgIn: 0, kgOut: 0, kgScrap: 0, ops: new Set() });
    const s = deptToday.get(d)!;
    s.kgIn += log.kgIn?.toNumber?.() ?? Number(log.kgIn) ?? 0;
    s.kgOut += log.kgOut?.toNumber?.() ?? Number(log.kgOut) ?? 0;
    s.kgScrap += log.kgScrap?.toNumber?.() ?? Number(log.kgScrap) ?? 0;
    s.ops.add(log.operatorId);
  }

  const departmentThroughput = knownDepts.map(dept => {
    let s = deptToday.get(dept);
    if (!s) {
      // fuzzy match (e.g. stored as "Forging" vs "Forging / chamfer")
      const lower = dept.toLowerCase();
      for (const [key, val] of deptToday) {
        if (key.toLowerCase().includes(lower.split('/')[0].trim()) || lower.includes(key.toLowerCase().split('/')[0].trim())) {
          s = val; break;
        }
      }
    }
    const kgIn = s?.kgIn ?? 0;
    const kgOut = s?.kgOut ?? 0;
    const kgScrap = s?.kgScrap ?? 0;
    const yieldPct = kgIn > 0 ? Math.round((kgOut / kgIn) * 1000) / 10 : 0;
    const jobs = activeMap.get(dept.toLowerCase()) ?? activeMap.get(dept.split('/')[0].trim().toLowerCase()) ?? 0;
    const ops = s?.ops.size ?? 0;
    return {
      department: dept,
      jobsActive: jobs,
      kgProcessed: Math.round(kgOut || kgIn),
      kgScrap: Math.round(kgScrap),
      yield: yieldPct,
      operators: ops,
    };
  });

  // Recent orders (tenant-scoped via db)
  const recentOrders = await db.productionOrder.findMany({
    take: 4,
    orderBy: { createdAt: "desc" },
    include: { design: true },
  });

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
    scrapByDept,
    departmentThroughput,
    recentOrders: recentOrders.map((o: any) => ({
      id: o.orderNumber,
      design: o.design?.name ?? '—',
      kg: o.targetKg?.toNumber?.() ?? Number(o.targetKg) ?? 0,
      status: o.status === "PENDING" ? "Pending approval" :
              o.status === "APPROVED" || o.status === "IN_PRODUCTION" ? "In production" : "Complete",
      dept: o.currentDept,
    })),
  };
}

export default async function AdminDashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/unauthorized");

  const db = getTenantPrisma(user.organizationId);
  const stats = await getAdminStats(db);

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
            <div className="stat-sub">{stats.inventory.length} materials · {stats.totalFree.toFixed(0)} kg free</div>

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
          <div className="stat-value">{(stats.scrapThisWeek || 0).toFixed(0)}</div>
          <div className="stat-sub">From production logs (last 7 days)</div>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="section-header mb-16"><div className="section-title">Recent production orders</div><Link href="/orders" className="btn btn-ghost btn-sm">View all</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Design</th><th>Kg reserved</th><th>Status</th><th>Dept</th></tr></thead>
              <tbody>
                {stats.recentOrders.slice(0, 4).map((order: any) => (
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
          {stats.scrapByDept.length > 0 ? (
            stats.scrapByDept.map((item: any, i: number) => {
              const cls = item.pct > 10 ? 'bad' : item.pct > 5 ? 'warn' : 'good';
              return (
                <div className="scrap-bar-wrap" key={i}>
                  <div className="scrap-bar-label">
                    <span>{item.dept}</span>
                    <span>{item.kg.toFixed(0)} kg · {item.pct}%</span>
                  </div>
                  <div className="scrap-bar">
                    <div className={`scrap-bar-fill ${cls}`} style={{width: `${Math.min(item.pct * 4, 100)}%`}}></div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{fontSize:'12px', color:'var(--muted)', padding:'8px 0'}}>No scrap data recorded this week.</div>
          )}
        </div>
      </div>
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Department throughput — today</div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Department</th><th>Jobs active</th><th>Kg processed</th><th>Kg scrap</th><th>Yield</th><th>Operators</th></tr></thead>
            <tbody>
              {stats.departmentThroughput.map((row: any, i: number) => {
                const y = row.yield;
                const yClass = y >= 95 ? 'badge-green' : y >= 85 ? 'badge-amber' : 'badge-red';
                return (
                  <tr key={i}>
                    <td>{row.department}</td>
                    <td>{row.jobsActive}</td>
                    <td><span className="job-kg">{row.kgProcessed} kg</span></td>
                    <td>{row.kgScrap} kg</td>
                    <td><span className={`badge ${yClass}`}>{y.toFixed(1)}%</span></td>
                    <td>{row.operators}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


