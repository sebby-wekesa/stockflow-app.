// components/admin/ReorderSuggestions.tsx
import { getReorderSuggestions } from "@/lib/actions/forecasting";

export default async function ReorderSuggestions() {
  const suggestions = await getReorderSuggestions();

  return (
    <div className="mt-8 bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 bg-blue-600 text-white">
        <h3 className="font-bold">Automated Reorder Suggestions</h3>
        <p className="text-xs opacity-80">Based on consumption patterns from the last 30 days</p>
      </div>
      
      <div className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3">Material</th>
              <th className="p-3">Burn Rate (Kg/Day)</th>
              <th className="p-3">Days Left</th>
              <th className="p-3 text-blue-600">Suggested Order</th>
              <th className="p-3">Preferred Supplier</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {suggestions.map((s) => (
              <tr key={s.id} className="hover:bg-blue-50/50">
                <td className="p-3 font-medium">{s.name} ({s.diameter})</td>
                <td className="p-3">{s.dailyBurnRate} kg</td>
                <td className="p-3">
                  <span className={`font-bold ${s.daysRemaining < 7 ? 'text-red-600' : 'text-orange-600'}`}>
                    {s.daysRemaining} days
                  </span>
                </td>
                <td className="p-3 font-black text-blue-700">{s.suggestedReorderKg} Kg</td>
                <td className="p-3 text-gray-500">{s.supplier || "Not Set"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {suggestions.length === 0 && (
          <p className="p-8 text-center text-gray-400 italic">Stock levels are healthy based on current usage.</p>
        )}
      </div>
    </div>
  );
}