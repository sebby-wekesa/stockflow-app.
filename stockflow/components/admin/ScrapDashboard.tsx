// components/admin/ScrapDashboard.tsx
import { getScrapStats } from "@/lib/actions/analytics";

export default async function ScrapDashboard() {
  const stats = await getScrapStats();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Material Yield & Scrap Report</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.department} className="p-4 bg-white border rounded-xl shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 uppercase">{stat.department}</h3>
            <div className="mt-2 flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold">{stat.totalScrap.toFixed(2)} Kg</p>
                <p className="text-xs text-gray-400">Total Scrap Logged</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${stat.yieldPercentage > 90 ? 'text-green-600' : 'text-amber-600'}`}>
                  {stat.yieldPercentage.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400">Efficiency</p>
              </div>
            </div>
            {/* Visual Progress Bar for Yield */}
            <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600" 
                style={{ width: `${stat.yieldPercentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}