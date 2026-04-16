"use client";

import { 
  TrendingUp, 
  Trash2, 
  Package, 
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { ResponsiveContainer, Area, AreaChart } from "recharts";

interface StatCardsProps {
  totalIn: number;
  totalOut: number;
  totalScrap: number;
}

export default function StatCards({ totalIn, totalOut, totalScrap }: StatCardsProps) {
  const globalYield = totalIn > 0 ? (totalOut / totalIn) * 100 : 0;
  const YIELD_THRESHOLD = 95;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KPICard 
        title="Material Intake" 
        value={`${totalIn.toLocaleString()} kg`}
        subtext="Total cumulative input"
        icon={<Package className="text-[#4a9eff]" size={20} />}
        chartColor="#4a9eff"
        trend="+8.2%"
      />
      <KPICard 
        title="Final Product" 
        value={`${totalOut.toLocaleString()} kg`}
        subtext="Weight passed forward"
        icon={<TrendingUp className="text-[#2ec4a0]" size={20} />}
        chartColor="#2ec4a0"
        trend="+12.4%"
      />
      <KPICard 
        title="Material Loss" 
        value={`${totalScrap.toLocaleString()} kg`}
        subtext="Scale, scrap, and waste"
        icon={<Trash2 className="text-[#e05555]" size={20} />}
        chartColor="#e05555"
        trend="-2.1%"
        trendUp={false}
      />
      <KPICard 
        title="Global Yield" 
        value={`${globalYield.toFixed(1)}%`}
        subtext={`Target: ${YIELD_THRESHOLD}%`}
        icon={<Activity className={globalYield >= YIELD_THRESHOLD ? "text-[#2ec4a0]" : "text-[#e05555]"} size={20} />}
        chartColor={globalYield >= YIELD_THRESHOLD ? "#2ec4a0" : "#e05555"}
        progress={globalYield}
      />
    </div>
  );
}

function KPICard({ title, value, subtext, icon, chartColor, progress, trend, trendUp = true }: any) {
  // Sample data for sparkline
  const sparkData = [
    { v: 40 }, { v: 45 }, { v: 42 }, { v: 48 }, { v: 52 }, { v: 48 }, { v: 55 }, { v: 60 }
  ];

  return (
    <div className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 group transition-all duration-300 hover:border-[#353a40] hover:translate-y-[-2px] relative overflow-hidden shadow-sm">
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
        <h4 className="text-xs font-semibold text-[#7a8090] mb-1 tracking-wide uppercase">{title}</h4>
        <div className="text-2xl font-bold text-[#e8eaed] mb-1 tracking-tight">{value}</div>
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
            <span>{Math.min(progress, 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-[#1e2023] rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ 
                width: `${Math.min(progress, 100)}%`, 
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
