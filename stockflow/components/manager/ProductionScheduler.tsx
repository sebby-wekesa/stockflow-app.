// components/manager/ProductionScheduler.tsx
import { getDepartmentLoad } from "@/lib/actions/scheduling";

export default async function ProductionScheduler({ activeOrders }: { activeOrders: any[] }) {
  const loadStats = await getDepartmentLoad();

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Production Scheduling</h2>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase">Total Active Load</p>
            <p className="text-xl font-bold">
              {activeOrders.reduce((acc, curr) => acc + curr.targetKg, 0).toFixed(2)} Kg
            </p>
          </div>
        </div>
      </header>

      {/* Department Load Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loadStats.map((dept) => (
          <div key={dept.currentDept} className="p-4 border rounded-lg bg-gray-50 shadow-sm">
            <h3 className="font-semibold text-gray-700">{dept.currentDept}</h3>
            <div className="mt-2 flex justify-between items-baseline">
              <span className="text-2xl font-black">{dept._count.id} Jobs</span>
              <span className="text-sm font-medium text-blue-600">{dept._sum.targetKg} Kg Total</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Order Timeline/List */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-sm font-semibold">Order #</th>
              <th className="p-4 text-sm font-semibold">Product</th>
              <th className="p-4 text-sm font-semibold">Current Dept</th>
              <th className="p-4 text-sm font-semibold">Priority</th>
              <th className="p-4 text-sm font-semibold">Target (Kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {activeOrders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 font-mono text-sm">{order.orderNumber}</td>
                <td className="p-4 font-medium">{order.design.name}</td>
                <td className="p-4">
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase">
                    {order.currentDept}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`text-xs font-bold ${
                    order.priority === 'URGENT' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {order.priority}
                  </span>
                </td>
                <td className="p-4 font-semibold">{order.targetKg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}