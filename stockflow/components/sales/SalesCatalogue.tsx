// components/sales/SalesCatalogue.tsx
"use client";

import { processSale } from "@/lib/actions/sales";
import { useState } from "react";

export default function SalesCatalogue({ inventory }: { inventory: any[] }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSale = async (id: string) => {
    const qty = prompt("Enter quantity to sell:");
    if (!qty || isNaN(Number(qty))) return;

    setLoading(id);
    await processSale({ finishedGoodId: id, quantitySold: Number(qty), customerId: "WALK_IN" });
    setLoading(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {inventory.map((item) => (
        <div key={item.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-bold text-lg">{item.design.name}</h3>
            <p className="text-xs text-gray-500 font-mono">{item.design.code}</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Available Stock:</span>
              <span className={`font-bold px-2 py-1 rounded text-sm ${
                item.quantity > 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {item.quantity} Units
              </span>
            </div>
            <button 
              onClick={() => handleSale(item.id)}
              disabled={loading === item.id || item.quantity <= 0}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300"
            >
              {item.quantity <= 0 ? "Out of Stock" : "Log Sale"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}