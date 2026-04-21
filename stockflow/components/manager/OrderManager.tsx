// components/manager/OrderManager.tsx
"use client";

import { releaseOrderWithBOM } from "@/lib/actions/bom-automation";
import { useState } from "react";

export default function OrderManager({ pendingOrders }: { pendingOrders: any[] }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleRelease = async (id: string) => {
    setLoading(id);
    await releaseOrderWithBOM(id);
    setLoading(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Pending Approval Queue</h2>
      <div className="grid gap-4">
        {pendingOrders.map((order) => (
          <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
            <div>
              <p className="font-mono text-sm text-blue-600">{order.orderNumber}</p>
              <h3 className="font-bold text-lg">{order.design.name}</h3>
              <p className="text-sm text-gray-500">Planned Input: {order.targetKg} Kg</p>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => handleRelease(order.id)}
                disabled={loading === order.id}
                className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:bg-gray-400"
              >
                {loading === order.id ? "Releasing..." : "Release to Production"}
              </button>
            </div>
          </div>
        ))}
        {pendingOrders.length === 0 && (
          <p className="text-center py-10 text-gray-400 border border-dashed rounded-lg">
            No orders awaiting approval.
          </p>
        )}
      </div>
    </div>
  );
}