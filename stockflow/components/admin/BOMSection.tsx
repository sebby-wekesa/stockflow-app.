"use client";

import { Link, Database, AlertCircle, Plus, X } from "lucide-react";

interface BOMItem {
  rawMaterialId: string;
  quantity: number;
  unitOfMeasure: string;
}

interface BOMSectionProps {
  rawMaterials: any[];
  bomItems?: BOMItem[];
  onAddItem?: () => void;
  onUpdateItem?: (index: number, field: keyof BOMItem, value: string | number) => void;
  onRemoveItem?: (index: number) => void;
}

export function BOMSection({
  rawMaterials,
  bomItems = [],
  onAddItem,
  onUpdateItem,
  onRemoveItem
}: BOMSectionProps) {
  return (
    <div className="mt-8 p-6 bg-[#0f1113] border border-[#2a2d32] rounded-2xl border-l-4 border-l-[#f0c040]">
      <h3 className="text-sm font-bold text-[#f0c040] uppercase flex items-center gap-2 mb-4">
        <Database size={16} /> Bill of Materials (BOM)
      </h3>

      {/* BOM Items List */}
      <div className="space-y-4 mb-4">
        {bomItems.map((item, index) => (
          <div key={index} className="flex items-center gap-4 p-4 bg-[#1e2023] border border-[#2a2d32] rounded-xl">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold text-[#7a8090]">Raw Material</label>
              <select
                value={item.rawMaterialId}
                onChange={(e) => onUpdateItem?.(index, 'rawMaterialId', e.target.value)}
                className="w-full bg-[#0f1113] border border-[#2c2d33] rounded-lg p-2 text-white text-sm outline-none"
              >
                <option value="">Select Material...</option>
                {rawMaterials.map(m => (
                  <option key={m.id} value={m.id}>{m.materialName} ({m.diameter})</option>
                ))}
              </select>
            </div>

            <div className="w-32 space-y-2">
              <label className="text-xs font-bold text-[#7a8090]">Quantity</label>
              <input
                type="number"
                step="0.001"
                value={item.quantity}
                onChange={(e) => onUpdateItem?.(index, 'quantity', parseFloat(e.target.value) || 0)}
                placeholder="0.125"
                className="w-full bg-[#0f1113] border border-[#2c2d33] rounded-lg p-2 text-white text-sm outline-none"
              />
            </div>

            <div className="w-24 space-y-2">
              <label className="text-xs font-bold text-[#7a8090]">Unit</label>
              <select
                value={item.unitOfMeasure}
                onChange={(e) => onUpdateItem?.(index, 'unitOfMeasure', e.target.value)}
                className="w-full bg-[#0f1113] border border-[#2c2d33] rounded-lg p-2 text-white text-sm outline-none"
              >
                <option value="kg">kg</option>
                <option value="pcs">pcs</option>
                <option value="m">m</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => onRemoveItem?.(index)}
              className="mt-6 p-2 text-red-400 hover:text-red-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Add Item Button */}
      <button
        type="button"
        onClick={onAddItem}
        className="w-full py-3 border border-dashed border-[#f0c040]/50 rounded-xl text-[#f0c040] text-sm hover:border-[#f0c040] hover:bg-[#f0c040]/10 transition-all flex items-center justify-center gap-2"
      >
        <Plus size={16} />
        Add BOM Item
      </button>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-[#7a8090]">
        <AlertCircle size={14} />
        <p>Phase 2: BOM quantities will auto-deduct from warehouse stock upon production order release.</p>
      </div>
    </div>
  );
}