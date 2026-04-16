import { prisma } from "@/lib/prisma";
import { YieldDashboard } from "@/components/YieldDashboard";
import { ExportButtons } from "@/components/admin/ExportButtons";

async function getYieldData() {
  // 1. Fetch Department Aggregates [cite: 98, 160]
  const stats = await prisma.stageLog.groupBy({
    by: ['stageName'],
    _sum: { kgIn: true, kgOut: true, kgScrap: true }
  });

  // 2. Fetch Scrap Distribution by Reason [cite: 33, 153]
  const scrapLogs = await prisma.stageLog.groupBy({
    by: ['scrapReason'],
    _sum: { kgScrap: true },
    where: { kgScrap: { gt: 0 } }
  });

  // 3. Fetch WIP (Work in Progress) [cite: 27, 99]
  const wipOrders = await prisma.productionOrder.findMany({
    where: { status: 'IN_PRODUCTION' },
    select: { currentDept: true, targetKg: true, id: true, logs: { select: { kgScrap: true } } }
  });

  const wipMap: Record<string, { kgRemaining: number; orderCount: number }> = {};
  for (const order of wipOrders) {
    const dept = order.currentDept || "Awaiting Start";
    const totalScrapSoFar = order.logs.reduce((s, l) => s + l.kgScrap, 0);
    const kgRemaining = Math.max(0, order.targetKg - totalScrapSoFar);
    if (!wipMap[dept]) wipMap[dept] = { kgRemaining: 0, orderCount: 0 };
    wipMap[dept].kgRemaining += kgRemaining;
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
    kgIn: s._sum.kgIn || 0,
    kgOut: s._sum.kgOut || 0,
    kgScrap: s._sum.kgScrap || 0,
    yieldPct: s._sum.kgIn ? ((s._sum.kgOut || 0) / s._sum.kgIn) * 100 : 0
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
}



export default async function YieldPage() {
  const data = await getYieldData();
  return (
    <div className="p-8 bg-[#0f1113] min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Yield Intelligence</h1>
        <ExportButtons />
      </div>
      <YieldDashboard data={data} />
    </div>
  );
}