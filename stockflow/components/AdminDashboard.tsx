import Link from "next/link";
import { withRetry } from '@/lib/prisma'

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
  rawMaterialItems: number;
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

function toNumber(value: any) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

async function safeQuery<T>(label: string, operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await withRetry(operation);
  } catch (error) {
    console.error(`[AdminDashboard] Failed to fetch ${label}`, error);
    return fallback;
  }
}

async function getAdminStats(db: any, organizationId: string): Promise<AdminStats> {
  try {
    const [
      totalOrders,
      pendingOrders,
      inProduction,
      completed,
      designs,
      users,
      rawMaterialItems,
      rawMaterialAgg,
      activeOrdersCount,
      finishedGoodsAgg,
    ] = await Promise.all([
      safeQuery('total production orders', () => db.productionOrder.count(), 0),
      safeQuery('pending production orders', () => db.productionOrder.count({ where: { status: "PENDING" } }), 0),
      safeQuery('in-production orders', () => db.productionOrder.count({ where: { status: "IN_PRODUCTION" } }), 0),
      safeQuery('completed production orders', () => db.productionOrder.count({ where: { status: "COMPLETED" } }), 0),
      safeQuery('design count', () => db.design.count(), 0),
      safeQuery('user count', () => db.user.count(), 0),
      safeQuery('raw material count', () => db.rawMaterial.count(), 0),
      safeQuery('raw material stock summary', () => db.rawMaterial.aggregate({
        _sum: {
          availableKg: true,
          reservedKg: true,
        },
      }), { _sum: { availableKg: 0, reservedKg: 0 } }),
      safeQuery('active production orders', () => db.productionOrder.count({
        where: { status: { in: ["APPROVED", "IN_PRODUCTION"] } },
      }), 0),
      safeQuery('finished goods summary', () => db.finishedGoods.aggregate({
        _sum: {
          kgProduced: true,
          quantity: true,
        },
      }), { _sum: { kgProduced: 0, quantity: 0 } }),
    ]);

    const totalFree = toNumber(rawMaterialAgg._sum.availableKg);
    const rawMaterialStock = totalFree + toNumber(rawMaterialAgg._sum.reservedKg);
    const pendingApprovalsCount = pendingOrders;

    const finishedGoods = {
      _sum: {
        kgProduced: toNumber(finishedGoodsAgg._sum.kgProduced),
        quantity: finishedGoodsAgg._sum.quantity ?? 0,
      }
    };

    // Continue with data transforms below...

  // ── Real data for previously hardcoded sections ──────────────────────────────
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Scrap this week (from StageLog)
  const scrapWeekAgg = await safeQuery<any>('weekly scrap summary', () => db.stageLog.aggregate({
    _sum: { kgScrap: true },
    where: { completedAt: { gte: oneWeekAgo } },
  }), { _sum: { kgScrap: 0 } });
  const scrapThisWeek = toNumber(scrapWeekAgg._sum.kgScrap);

  // Scrap by department this week
  const scrapDeptRaw = await safeQuery<any[]>('scrap by department', () => db.stageLog.groupBy({
    by: ['department'],
    _sum: { kgScrap: true },
    where: {
      completedAt: { gte: oneWeekAgo },
      department: { not: null },
    },
    orderBy: { _sum: { kgScrap: 'desc' } },
  }), []);
  const totalScrapForPct = (scrapDeptRaw as any[]).reduce((s: number, r: any) => s + toNumber(r._sum.kgScrap), 0) || 1;
  const scrapByDept = (scrapDeptRaw as any[]).map((r: any) => {
    const kg = toNumber(r._sum.kgScrap);
    const pct = Math.round((kg / totalScrapForPct) * 100);
    return { dept: r.department!, kg, pct };
  });

  // Department throughput for today (from StageLog + active ProductionOrders)
  // Load department list from tenant settings if present
  const { getDepartmentsForOrg } = await import('@/lib/department-settings')
  const knownDepts = getDepartmentsForOrg(organizationId);

  const activeByDeptRaw = await safeQuery<any[]>('active jobs by department', () => db.productionOrder.groupBy({
    by: ['currentDept'],
    _count: { _all: true },
    where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] }, currentDept: { not: null } },
  }), []);
  const activeMap = new Map((activeByDeptRaw as any[]).map((a: any) => [ (a.currentDept || '').toLowerCase(), a._count._all ]));

  // Fetch today's logs to compute distinct operators + aggregates per dept
  const todayLogs = await safeQuery<any[]>('today stage logs', () => db.stageLog.findMany({
    where: { completedAt: { gte: todayStart }, department: { not: null } },
    select: { department: true, operatorId: true, kgIn: true, kgOut: true, kgScrap: true },
  }), []);

    const deptToday = new Map<string, { kgIn: number; kgOut: number; kgScrap: number; ops: Set<string> }>();
   for (const log of todayLogs) {
     const d = log.department!;
     if (!deptToday.has(d)) deptToday.set(d, { kgIn: 0, kgOut: 0, kgScrap: 0, ops: new Set() });
     const s = deptToday.get(d)!;
     s.kgIn += toNumber(log.kgIn);
     s.kgOut += toNumber(log.kgOut);
     s.kgScrap += toNumber(log.kgScrap);
     s.ops.add(log.operatorId);
   }

   const departmentThroughput = knownDepts.map(dept => {
     let s = deptToday.get(dept);
     if (!s) {
       // Fuzzy match configured department variants.
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
     const jobs = Number(activeMap.get(dept.toLowerCase()) ?? activeMap.get(dept.split('/')[0].trim().toLowerCase()) ?? 0);
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
  const recentOrders = await safeQuery<any[]>('recent production orders', () => db.productionOrder.findMany({
    take: 4,
    orderBy: { createdAt: "desc" },
    include: { design: true },
  }), []);

    return {
      totalOrders: Number(totalOrders ?? 0),
      pendingOrders: Number(pendingOrders ?? 0),
      inProduction: Number(inProduction ?? 0),
      completed: Number(completed ?? 0),
      designs: Number(designs ?? 0),
      users: Number(users ?? 0),
      rawMaterialItems: Number(rawMaterialItems ?? 0),
      rawMaterialStock: Number(rawMaterialStock ?? 0),
      totalFree: Number(totalFree ?? 0),
      activeOrdersCount: Number(activeOrdersCount ?? 0),
      pendingApprovalsCount: Number(pendingApprovalsCount ?? 0),
      finishedGoods: finishedGoods as any,
      scrapThisWeek: Number(scrapThisWeek ?? 0),
      scrapByDept: scrapByDept as any[],
      departmentThroughput: departmentThroughput as DeptThroughput[],
      recentOrders: (recentOrders as any[]).map((o: any) => ({
        id: o.orderNumber,
        design: o.design?.name ?? '—',
        kg: toNumber(o.targetKg),
        status: o.status === "PENDING" ? "Pending approval" :
                o.status === "APPROVED" || o.status === "IN_PRODUCTION" ? "In production" : "Complete",
        dept: o.currentDept,
      })),
    };
  } catch (err) {
    console.error('[AdminDashboard] DB unavailable, returning safe defaults', String(err));
    // Return safe defaults so the dashboard renders without total DB stats
    return {
      totalOrders: 0,
      pendingOrders: 0,
      inProduction: 0,
      completed: 0,
      designs: 0,
      users: 0,
      rawMaterialItems: 0,
      rawMaterialStock: 0,
      totalFree: 0,
      activeOrdersCount: 0,
      pendingApprovalsCount: 0,
      finishedGoods: { _sum: { kgProduced: 0, quantity: 0 } },
      scrapThisWeek: 0,
      scrapByDept: [],
      departmentThroughput: [],
      recentOrders: [],
    };
  }
}

interface AdminDashboardProps {
  user: any;
}

export default async function AdminDashboard({ user }: AdminDashboardProps) {
  if (!user) {
    return <div className="p-8 text-center text-muted">No user context provided.</div>;
  }

  const { getTenantPrisma } = await import("@/lib/tenant-prisma");
  const db = getTenantPrisma(user.organizationId);
  const stats = await getAdminStats(db, user.organizationId);

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Overview</div><div className="section-sub">Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div></div>
        <Link href="/production/new" className="btn btn-primary">+ New production order</Link>
      </div>
      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-label">Raw material stock</div>
          <div className="stat-value">{stats.rawMaterialStock.toFixed(0)}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
            <div className="stat-sub">{stats.rawMaterialItems} materials · {stats.totalFree.toFixed(0)} kg free</div>

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
