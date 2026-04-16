import { prisma } from "@/lib/prisma";
import { YieldDashboard } from "@/components/YieldDashboard";

function calculateGlobalYield(stats: any[]) {
  const totalIn = stats.reduce((acc, s) => acc + (s._sum.kgIn || 0), 0);
  const totalOut = stats.reduce((acc, s) => acc + (s._sum.kgOut || 0), 0);
  return totalIn ? (totalOut / totalIn) * 100 : 0;
}

async function getYieldData() {
  // 1. Fetch Department Aggregates [cite: 98, 160]
  const stats = await prisma.productionStageLog.groupBy({
    by: ['department'],
    _sum: { kgIn: true, kgOut: true, kgScrap: true }
  });

  // 2. Fetch Scrap Distribution by Reason [cite: 33, 153]
  const scrapLogs = await prisma.productionStageLog.groupBy({
    by: ['scrapReason'],
    _sum: { kgScrap: true }
  });

  // 3. Fetch WIP (Work in Progress) [cite: 27, 99]
  const wipOrders = await prisma.productionOrder.groupBy({
    by: ['currentDept'],
    _count: { id: true },
    _sum: { currentKg: true }, // Assumes currentKg tracks active weight
    where: { status: 'IN_PRODUCTION' }
  });

  // Transform into your YieldData type
  return {
    globalYield: calculateGlobalYield(stats), // Logic: (Total Out / Total In) * 100
    totals: {
      kgIn: stats.reduce((acc, s) => acc + (s._sum.kgIn || 0), 0),
      kgOut: stats.reduce((acc, s) => acc + (s._sum.kgOut || 0), 0),
      kgScrap: stats.reduce((acc, s) => acc + (s._sum.kgScrap || 0), 0),
    },
    departmentStats: stats.map(s => ({
      department: s.department,
      kgIn: s._sum.kgIn || 0,
      kgOut: s._sum.kgOut || 0,
      kgScrap: s._sum.kgScrap || 0,
      yieldPct: s._sum.kgIn ? ((s._sum.kgOut || 0) / s._sum.kgIn) * 100 : 0
    })),
    scrapDistribution: scrapLogs.map(l => ({
      reason: l.scrapReason || "Unspecified",
      kgScrap: l._sum.kgScrap || 0
    })),
    wip: wipOrders.map(w => ({
      department: w.currentDept || "Unknown",
      kgRemaining: w._sum.currentKg || 0,
      orderCount: w._count.id
    }))
  };
}

export default async function YieldPage() {
  const data = await getYieldData();
  return (
    <div className="p-8 bg-[#0f1113] min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6">Yield Intelligence</h1>
      <YieldDashboard data={data} />
    </div>
  );
}