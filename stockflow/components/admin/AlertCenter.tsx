import { getLowStockAlerts } from "@/lib/actions/inventory-alerts";

export default async function AlertCenter() {
  const alerts = await getLowStockAlerts();

  if (alerts.length === 0) return null;

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg my-6">
      <div className="flex items-center mb-2">
        <span className="text-red-800 font-bold text-lg">⚠️ Inventory Alerts</span>
      </div>
      <div className="space-y-3">
        {alerts.map((item) => (
          <div key={item.id} className="flex justify-between items-center text-sm border-b border-red-100 pb-2">
            <div>
              <span className="font-bold text-red-900">{item.materialName} ({item.diameter})</span>
              <p className="text-red-700">Stock: <span className="underline">{item.availableKg} Kg</span> remaining</p>
            </div>
            <div className="text-right">
              <span className={`px-2 py-1 rounded text-xs font-black ${
                item.urgency === 'HIGH' ? 'bg-red-200 text-red-900' : 'bg-orange-100 text-orange-800'
              }`}>
                {item.urgency} PRIORITY
              </span>
              <p className="text-xs text-gray-500 mt-1">Supplier: {item.supplier?.name || "None"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}