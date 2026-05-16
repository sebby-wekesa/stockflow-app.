// components/admin/RunwayAlerts.tsx
import { AlertTriangle, TrendingDown } from "lucide-react";

type NumericLike = number | string | { toNumber(): number } | null | undefined;

type InventoryItem = {
  availableKg?: NumericLike;
  reservedKg?: NumericLike;
};

function toNumber(value: NumericLike) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value) || 0;
  }

  if (value && typeof value === "object" && "toNumber" in value) {
    return value.toNumber();
  }

  return 0;
}

export function RunwayAlerts({ inventory }: { inventory: InventoryItem[] }) {
  // Logic: Filter materials where reserved weight is approaching total weight
  const criticalStock = inventory.filter(item => {
    const available = toNumber(item.availableKg);
    const reserved = toNumber(item.reservedKg);
    const total = available + reserved;

    if (total === 0) return false;

    return available / total < 0.2;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      {/* Critical Stock Alert */}
      <div className="bg-[#1c1212] border border-red-500/30 rounded-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
            <AlertTriangle size={20} />
          </div>
          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded">CRITICAL</span>
        </div>
        <h3 className="text-white font-bold">Material Shortage Warning</h3>
        <p className="text-xs text-[#7a8090] mt-1">
          {criticalStock.length > 0 
            ? `You have ${criticalStock.length} materials below 20% availability.` 
            : "All raw materials are currently at healthy levels."}
        </p>
      </div>

      {/* Production Load Status */}
      <div className="bg-[#12161c] border border-[#4a9eff]/30 rounded-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-[#4a9eff]/10 rounded-lg text-[#4a9eff]">
            <TrendingDown size={20} />
          </div>
          <span className="text-[10px] font-bold text-[#4a9eff] bg-[#4a9eff]/10 px-2 py-1 rounded">WIP ANALYSIS</span>
        </div>
        <h3 className="text-white font-bold">Current Production Load</h3>
        <p className="text-xs text-[#7a8090] mt-1">Total metal currently in processing across all departments.</p>
      </div>
    </div>
  );
}
