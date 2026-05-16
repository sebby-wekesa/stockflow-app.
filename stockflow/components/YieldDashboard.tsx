"use client";

// Temporarily use any to bypass build blocker for demo
type Decimal = any;

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { 
  AlertTriangle, 
  TrendingUp, 
  Trash2, 
  Package, 
  Activity, 
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

export type DeptStat = {
  department: string;
  kgIn: number;
  kgOut: number;
  kgScrap: number;
  yieldPct: number;
};

export type ScrapEntry = {
  reason: string;
  kgScrap: number | Decimal;
};

export type WipEntry = {
  department: string;
  kgRemaining: number;
  orderCount: number;
};

export type YieldTrend = {
  date: string;
  kgIn: number;
  kgOut: number;
  kgScrap: number;
  yieldPct: number;
};

export type DepartmentTrend = {
  department: string;
  data: YieldTrend[];
};

export type DesignYield = {
  design_name: string;
  design_code: string;
  total_kg_in: number;
  total_kg_out: number;
  total_kg_scrap: number;
  yield_percentage: number;
};

export type YieldData = {
  globalYield: number;
  totals: { kgIn: number; kgOut: number; kgScrap: number };
  departmentStats: DeptStat[];
  scrapDistribution: ScrapEntry[];
  wip: WipEntry[];
  yieldTrends?: YieldTrend[];
  departmentTrends?: DepartmentTrend[];
  designYield?: DesignYield[];
};

const PIE_COLORS = ["#4a9eff", "#8b7cf8", "#f0c040", "#2ec4a0", "#e05555", "#e07b30", "#4caf7d"];
const YIELD_THRESHOLD = 95;

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// Premium Tooltip
const CustomTooltip = ({ active, payload, label, unit = "kg" }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1b1e] border border-[#2c2d33] rounded-xl p-4 shadow-2xl backdrop-blur-md bg-opacity-90">
      <div className="text-xs font-bold text-[#7a8090] uppercase tracking-wider mb-2">{label}</div>
      <div className="space-y-1.5">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill || p.color }} />
              <span className="text-sm text-[#e8eaed]">{p.name}</span>
            </div>
            <span className="text-sm font-mono font-bold text-[#e8eaed]">
              {fmt(p.value)} {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function YieldDashboard({ data }: { data: YieldData }) {
  const { globalYield, totals, departmentStats, scrapDistribution, wip, yieldTrends, departmentTrends, designYield } = data;

  const barData = (departmentStats || []).map((d) => ({
    name: d.department,
    Input: d.kgIn,
    Output: d.kgOut,
    Scrap: d.kgScrap,
    yield: d.yieldPct,
  }));

  const totalProcessed = totals.kgIn;
  const totalScrap = totals.kgScrap;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      
      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Global Yield Card */}
        <KPICard 
          title="Global Yield %" 
          value={`${globalYield.toFixed(1)}%`}
          subtext={`Target: ${YIELD_THRESHOLD}%`}
          icon={<TrendingUp className={globalYield >= YIELD_THRESHOLD ? "text-[#2ec4a0]" : "text-[#e05555]"} size={20} />}
          chartColor={globalYield >= YIELD_THRESHOLD ? "#2ec4a0" : "#e05555"}
          progress={globalYield}
        />

        {/* Total Processed Card */}
        <KPICard 
          title="Total Processed" 
          value={`${fmt(totalProcessed)} kg`}
          subtext="Cumulative input material"
          icon={<Package className="text-[#4a9eff]" size={20} />}
          chartColor="#4a9eff"
          trend="+12% vs last week"
        />

        {/* Total Scrap Card */}
        <KPICard 
          title="Total Material Loss" 
          value={`${fmt(totalScrap)} kg`}
          subtext="Total scrap generated"
          icon={<Trash2 className="text-[#e05555]" size={20} />}
          chartColor="#e05555"
          trend="-3% vs last month"
          trendUp={false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ── Department Comparison ── */}
        <section className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 shadow-sm overflow-hidden group">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-[#e8eaed] flex items-center gap-2">
                <Activity size={18} className="text-[#4a9eff]" />
                Departmental Performance
              </h3>
              <p className="text-sm text-[#7a8090]">Comparison of material input vs output</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#1e2023] rounded-lg border border-[#353a40]">
              <span className="w-2 h-2 rounded-full bg-[#f0c040] animate-pulse" />
              <span className="text-[10px] font-bold text-[#7a8090] uppercase tracking-tighter">Live Aggregate</span>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a9eff" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#4a9eff" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d32" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#7a8090", fontSize: 11 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#7a8090", fontSize: 10 }}
                  unit=" kg"
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="Input" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="Output" radius={[6, 6, 0, 0]} barSize={24}>
                  {barData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.yield >= YIELD_THRESHOLD ? "#2ec4a0" : "#e05555"} 
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 pt-6 border-t border-[#2a2d32] grid grid-cols-2 gap-4">
             {(departmentStats || []).filter(d => d.yieldPct < YIELD_THRESHOLD).map(d => (
               <div key={d.department} className="flex items-center gap-3 p-3 bg-red-900/10 border border-red-500/20 rounded-xl">
                 <AlertTriangle size={16} className="text-red-500 shrink-0" />
                 <div>
                   <div className="text-xs font-bold text-red-500 uppercase">{d.department} ALERT</div>
                   <div className="text-[11px] text-red-400/80">Yield: {d.yieldPct}% (Critical)</div>
                 </div>
               </div>
             ))}
             {(departmentStats || []).filter(d => d.yieldPct < YIELD_THRESHOLD).length === 0 && (
               <div className="col-span-2 text-center py-4 text-xs text-[#7a8090] italic">
                 All departments operating above efficiency terminal.
               </div>
             )}
          </div>
        </section>

        {/* ── Scrap Reason Distribution ── */}
        <section className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 shadow-sm overflow-hidden">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-[#e8eaed]">Scrap Distribution</h3>
            <p className="text-sm text-[#7a8090]">Breakdown of material loss by cause</p>
          </div>

          <div className="h-[300px] w-full flex items-center justify-center">
            {(scrapDistribution || []).length === 0 ? (
              <div className="text-[#7a8090] text-sm">No scrap data recorded.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scrapDistribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="kgScrap"
                    nameKey="reason"
                    stroke="none"
                  >
                    {(scrapDistribution || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="middle" 
                    align="right" 
                    layout="vertical"
                    formatter={(value) => <span className="text-xs text-[#7a8090] py-1">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* ── Yield Trends ── */}
      <section className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 shadow-sm overflow-hidden">
        <div className="mb-8">
          <h3 className="text-lg font-bold text-[#e8eaed] flex items-center gap-2">
            <TrendingUp size={18} className="text-[#2ec4a0]" />
            Yield Trends (90 Days)
          </h3>
          <p className="text-sm text-[#7a8090]">Historical yield performance and material flow</p>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={yieldTrends || []} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2ec4a0" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2ec4a0" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="scrapGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e05555" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#e05555" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d32" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#7a8090", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#7a8090", fontSize: 10 }}
                unit=" kg"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="kgOut"
                stackId="1"
                stroke="#2ec4a0"
                fill="url(#yieldGradient)"
                name="Output"
              />
              <Area
                type="monotone"
                dataKey="kgScrap"
                stackId="1"
                stroke="#e05555"
                fill="url(#scrapGradient)"
                name="Scrap"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Department Trends ── */}
        <section className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 shadow-sm overflow-hidden">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-[#e8eaed] flex items-center gap-2">
              <Activity size={18} className="text-[#4a9eff]" />
              Department Yield Trends
            </h3>
            <p className="text-sm text-[#7a8090]">Yield performance by department over time</p>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {departmentTrends?.map((dept) => (
              <div key={dept.department} className="space-y-2">
                <h4 className="text-sm font-semibold text-[#e8eaed]">{dept.department}</h4>
                <div className="h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dept.data}>
                      <Area
                        type="monotone"
                        dataKey="yieldPct"
                        stroke="#4a9eff"
                        fill="#4a9eff"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Design Yield Analysis ── */}
        <section className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 shadow-sm overflow-hidden">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-[#e8eaed] flex items-center gap-2">
              <AlertTriangle size={18} className="text-[#f0c040]" />
              Design Yield Analysis
            </h3>
            <p className="text-sm text-[#7a8090]">Yield performance by product design</p>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {(designYield || [])
              .sort((a, b) => a.yield_percentage - b.yield_percentage)
              .map((design) => (
                <div key={design.design_code} className="flex items-center justify-between p-3 bg-[#1e2023] border border-[#2c2d33] rounded-xl">
                  <div>
                    <div className="text-sm font-semibold text-[#e8eaed]">{design.design_name}</div>
                    <div className="text-xs text-[#7a8090]">{design.design_code}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${design.yield_percentage >= YIELD_THRESHOLD ? 'text-[#2ec4a0]' : 'text-[#e05555]'}`}>
                      {design.yield_percentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[#7a8090]">
                      {fmt(design.total_kg_out)} / {fmt(design.total_kg_in)} kg
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>

      {/* ── WIP Tracker ── */}
      <section className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-[#e8eaed]">Live WIP Tracker</h3>
            <p className="text-sm text-[#7a8090]">Current material load across department queues</p>
          </div>
          <button className="text-xs font-bold text-[#4a9eff] hover:underline flex items-center gap-1">
            VIEW FULL PIPELINE <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(wip || []).length === 0 ? (
            <div className="col-span-full py-12 text-center border border-dashed border-[#2a2d32] rounded-2xl text-[#7a8090]">
              No active production orders found.
            </div>
          ) : (
            (wip || []).map((item) => (
              <WIPCard key={item.department} {...item} />
            ))
          )}
        </div>
      </section>

    </div>
  );
}

function KPICard({ title, value, subtext, icon, chartColor, progress, trend, trendUp = true }: any) {
  // Sample data for the sparkline
  const sparkData = [
    { v: 40 }, { v: 45 }, { v: 42 }, { v: 48 }, { v: 52 }, { v: 48 }, { v: 55 }, { v: 60 }
  ];

  return (
    <div className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 group transition-all duration-300 hover:border-[#353a40] hover:translate-y-[-2px] relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-opacity-[0.03] rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" style={{ backgroundColor: chartColor }} />
      
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-[#1e2023] rounded-xl border border-[#2c2d33] transition-colors group-hover:border-[#353a40]">
          {icon}
        </div>
        <div className="h-8 w-16 opacity-50 group-hover:opacity-100 transition-opacity">
           <ResponsiveContainer width="100%" height="100%">
             <AreaChart data={sparkData}>
               <Area 
                 type="monotone" 
                 dataKey="v" 
                 stroke={chartColor} 
                 fill={chartColor} 
                 fillOpacity={0.1} 
                 strokeWidth={1.5} 
               />
             </AreaChart>
           </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-[#7a8090] mb-1">{title}</h4>
        <div className="text-3xl font-bold text-[#e8eaed] mb-1 tracking-tight">{value}</div>
        <div className="flex items-center gap-2">
          {trend && (
             <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${trendUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
               {trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
               {trend}
             </span>
          )}
          <div className="text-[11px] text-[#7a8090]">{subtext}</div>
        </div>
      </div>

      {progress !== undefined && (
        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between text-[10px] font-bold text-[#7a8090]">
            <span>STABILITY</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-[#1e2023] rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ 
                width: `${progress}%`, 
                backgroundColor: chartColor,
                boxShadow: `0 0 10px ${chartColor}40`
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

function WIPCard({ department, kgRemaining, orderCount }: WipEntry) {
  return (
    <div className="bg-[#1e2023] border border-[#2c2d33] rounded-2xl p-5 hover:bg-[#25272b] transition-all group">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1.5 h-6 bg-[#8b7cf8] rounded-full group-hover:scale-y-125 transition-transform" />
        <h5 className="text-xs font-bold text-[#7a8090] uppercase tracking-widest">{department}</h5>
      </div>
      
      <div className="space-y-1">
        <div className="text-2xl font-mono font-bold text-[#e8eaed]">
          {fmt(kgRemaining)} <span className="text-xs font-normal text-[#7a8090] uppercase ml-1">kg</span>
        </div>
        <p className="text-[11px] text-[#7a8090] flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[#8b7cf8]" />
          {orderCount} Active Order{orderCount === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
