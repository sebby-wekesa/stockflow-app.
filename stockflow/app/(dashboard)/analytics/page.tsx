import { prisma } from "@/lib/prisma";
import YieldCharts from "@/components/analytics/YieldCharts";
import StatCards from "@/components/analytics/StatCards";

export default async function AnalyticsPage() {
  // 1. Fetch total stats (kgIn, kgOut, kgScrap)
  const logs = await prisma.stageLog.aggregate({
    _sum: {
      kgIn: true,
      kgOut: true,
      kgScrap: true,
    }
  });

  // 2. Fetch scrap distribution by reason
  const scrapData = await prisma.stageLog.groupBy({
    by: ['scrapReason'],
    _sum: { kgScrap: true },
    where: { kgScrap: { gt: 0 } }
  });

  // 3. Fetch yield by Stage/Department for performance visualization
  const deptData = await prisma.stageLog.groupBy({
    by: ['stageName'],
    _sum: { kgIn: true, kgOut: true }
  });

  // 4. Format data for the charts
  const formattedDeptData = deptData.map(d => ({
    name: d.stageName,
    input: d._sum.kgIn || 0,
    output: d._sum.kgOut || 0,
    // Calculate efficiency as (Output / Input) * 100
    efficiency: d._sum.kgIn && d._sum.kgIn > 0 
      ? parseFloat(((d._sum.kgOut || 0) / d._sum.kgIn * 100).toFixed(1)) 
      : 0
  }));

  const formattedScrapData = scrapData.map(s => ({
    reason: s.scrapReason || 'Unspecified',
    value: s._sum.kgScrap || 0
  }));

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#e8eaed] tracking-tight">Yield Intelligence</h1>
          <p className="text-[#7a8090]">Real-time material efficiency and waste tracking across the factory floor.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#161719] border border-[#2a2d32] rounded-xl">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-bold text-[#7a8090] uppercase tracking-widest">Live Integration</span>
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <StatCards 
        totalIn={logs._sum.kgIn || 0} 
        totalOut={logs._sum.kgOut || 0} 
        totalScrap={logs._sum.kgScrap || 0} 
      />

      {/* ── Visual Analytics Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <YieldCharts 
          deptData={formattedDeptData} 
          scrapReasons={formattedScrapData} 
        />
      </div>

      {/* ── Bottom Insight ── */}
      <div className="bg-[#161719] border border-[#2a2d32] border-dashed rounded-2xl p-6 text-center">
        <p className="text-sm text-[#7a8090]">
          Data updated automatically with every station handoff. 
          <span className="text-[#4a9eff] ml-1 cursor-pointer hover:underline font-semibold">View Raw Log History</span>
        </p>
      </div>

    </div>
  );
}
