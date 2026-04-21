// components/admin/ScrapRootCause.tsx
import { getScrapRootCauses } from "@/lib/actions/analytics-advanced";

export default async function ScrapRootCause() {
  const causes = await getScrapRootCauses();
  const totalScrap = causes.reduce((acc, curr) => acc + curr.weight, 0);

  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm">
      <h3 className="text-lg font-bold mb-4">Scrap Root Cause Analysis</h3>
      
      <div className="space-y-4">
        {causes.sort((a, b) => b.weight - a.weight).map((cause) => {
          const percentage = ((cause.weight / totalScrap) * 100).toFixed(1);
          
          return (
            <div key={cause.reason}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{cause.reason}</span>
                <span className="text-gray-500">{cause.weight} Kg ({percentage}%)</span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-red-500 h-full transition-all" 
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-dashed">
        <p className="text-xs text-gray-500 text-center">
          💡 **Insight:** {causes[0]?.reason} is your leading cause of waste. 
          Focusing on this could save approx. {causes[0]?.weight.toFixed(1)} Kg per cycle.
        </p>
      </div>
    </div>
  );
}