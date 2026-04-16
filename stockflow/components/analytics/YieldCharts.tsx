"use client";

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { Activity, PieChart as PieIcon } from 'lucide-react';

const COLORS = ['#4a9eff', '#8b7cf8', '#f0c040', '#2ec4a0', '#e05555'];

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
              {p.value?.toLocaleString()} {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function YieldCharts({ deptData, scrapReasons }: any) {
  return (
    <>
      {/* Department Performance Bar Chart */}
      <div className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 shadow-sm overflow-hidden group">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-[#e8eaed] flex items-center gap-2">
              <Activity size={18} className="text-[#4a9eff]" />
              Department Efficiency (%)
            </h3>
            <p className="text-sm text-[#7a8090]">Conversion rate from input metal to output product</p>
          </div>
        </div>

        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
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
                interval={0}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#7a8090", fontSize: 10 }}
                unit="%"
                domain={[0, 100]}
              />
              <Tooltip 
                content={<CustomTooltip unit="%" />} 
                cursor={{ fill: "rgba(255,255,255,0.03)" }} 
              />
              <Bar 
                dataKey="efficiency" 
                name="Efficiency"
                fill="url(#yieldGradient)" 
                radius={[6, 6, 0, 0]} 
                barSize={32} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scrap Distribution Pie Chart */}
      <div className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 shadow-sm overflow-hidden">
        <div className="mb-8">
          <h3 className="text-lg font-bold text-[#e8eaed] flex items-center gap-2">
            <PieIcon size={18} className="text-[#e05555]" />
            Scrap Distribution (kg)
          </h3>
          <p className="text-sm text-[#7a8090]">Categorized material loss across all stages</p>
        </div>

        <div className="h-[350px] w-full flex items-center justify-center">
          {scrapReasons.length === 0 ? (
            <div className="text-[#7a8090] text-sm animate-pulse">No scrap data detected...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scrapReasons}
                  dataKey="value"
                  nameKey="reason"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={5}
                  stroke="none"
                >
                  {scrapReasons.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
      </div>
    </>
  );
}
