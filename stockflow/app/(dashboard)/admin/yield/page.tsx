export const dynamic = 'force-dynamic';

import { YieldDashboard } from "@/components/YieldDashboard";
import { ExportButtons } from "@/components/admin/ExportButtons";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";

async function getYieldData(organizationId: string) {
  const db = getTenantPrisma(organizationId);
  try {
    // 1. Fetch Department Aggregates
    const stats = await db.stageLog.groupBy({
      by: ['stageName'],
      _sum: { kgIn: true, kgOut: true, kgScrap: true }
    });

    // 2. Fetch Scrap Distribution by Reason
    const scrapLogs = await db.stageLog.groupBy({
      by: ['scrapReason'],
      _sum: { kgScrap: true },
      where: { kgScrap: { gt: 0 } }
    });

    // 3. Fetch WIP (Work in Progress)
    const wipOrders = await db.productionOrder.findMany({
      where: { status: 'IN_PRODUCTION' },
      select: {
        currentDept: true,
        targetKg: true,
        id: true,
        StageLog: {
          select: { kgOut: true },
          orderBy: { completedAt: 'desc' },
          take: 1
        }
      }
    });

    const wipMap: Record<string, { kgRemaining: number; orderCount: number }> = {};
    for (const order of wipOrders) {
      const dept = order.currentDept || "Awaiting Start";
      const lastLog = order.StageLog[0];
      const kgRemaining = lastLog ? lastLog.kgOut.toNumber() : order.targetKg.toNumber();
      if (!wipMap[dept]) wipMap[dept] = { kgRemaining: 0, orderCount: 0 };
      wipMap[dept].kgRemaining += Math.max(0, kgRemaining);
      wipMap[dept].orderCount += 1;
    }

    const wip = Object.entries(wipMap).map(([dept, v]) => ({
      department: dept,
      kgRemaining: +v.kgRemaining.toFixed(2),
      orderCount: v.orderCount,
    }));

    // Transform into your YieldData type
    const departmentStats = stats.map(s => ({
      department: s.stageName || "Unspecified",
      kgIn: s._sum.kgIn?.toNumber() || 0,
      kgOut: s._sum.kgOut?.toNumber() || 0,
      kgScrap: s._sum.kgScrap?.toNumber() || 0,
      yieldPct: s._sum.kgIn && s._sum.kgIn.toNumber() > 0 ? ((s._sum.kgOut?.toNumber() || 0) / s._sum.kgIn.toNumber()) * 100 : 0
    }));

    const totals = departmentStats.reduce(
      (acc, d) => ({
        kgIn: acc.kgIn + d.kgIn,
        kgOut: acc.kgOut + d.kgOut,
        kgScrap: acc.kgScrap + d.kgScrap,
      }),
      { kgIn: 0, kgOut: 0, kgScrap: 0 }
    );

    return {
      globalYield: totals.kgIn > 0 ? (totals.kgOut / totals.kgIn) * 100 : 0,
      totals,
      departmentStats,
      scrapDistribution: scrapLogs.map(l => ({
        reason: l.scrapReason || "Unspecified",
        kgScrap: l._sum.kgScrap || 0
      })),
      wip
    };
  } catch (error) {
    console.error('Error fetching yield data:', error);
    // Return empty data to prevent breaking the UI
    return {
      globalYield: 0,
      totals: { kgIn: 0, kgOut: 0, kgScrap: 0 },
      departmentStats: [],
      scrapDistribution: [],
      wip: []
    };
  }
}



export default async function YieldPage() {
  const user = await requireActiveAuth();
  const data = await getYieldData(user.organizationId);
  return (
    <>
      <div className="section-header">
        <div>
          <h1 className="section-title">Yield Intelligence</h1>
        </div>
        <ExportButtons />
      </div>
      <YieldDashboard data={data} />
    </>
  );
}