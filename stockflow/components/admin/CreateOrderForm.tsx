"use client";

import { ClipboardList, PlayCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface Design {
  id: string;
  name: string;
  targetWeight: number;
}

interface RawMaterial {
  id: string;
  materialName: string;
  diameter: string;
  availableKg: number;
  reservedKg: number;
  supplier?: string;
}

export function CreateOrderForm({ designs }: { designs: Design[] }) {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [customerRef, setCustomerRef] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockValidationError, setStockValidationError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMaterials() {
      try {
        const response = await fetch('/api/inventory/materials');
        const data = await response.json();
        if (data.success) {
          setMaterials(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch materials:', error);
      }
    }
    fetchMaterials();
  }, []);

  // Logic: Calculate required KG based on Design Template
  const requiredKg = selectedDesign && quantity > 0 ? (selectedDesign.targetWeight * quantity) : 0;

  // Real-time stock validation
  const remainingKg = selectedMaterial && requiredKg > 0 ? (selectedMaterial.availableKg - requiredKg).toFixed(2) : null;
  const hasInsufficientStock = selectedMaterial && requiredKg > 0 && requiredKg > selectedMaterial.availableKg;

  // Update validation error when dependencies change
  useEffect(() => {
    if (selectedMaterial && requiredKg > 0) {
      if (hasInsufficientStock) {
        setStockValidationError(`Insufficient stock: Need ${requiredKg.toFixed(2)}kg, only ${selectedMaterial.availableKg}kg available`);
      } else {
        setStockValidationError(null);
      }
    } else {
      setStockValidationError(null);
    }
  }, [selectedMaterial, requiredKg, hasInsufficientStock]);

  const handleSubmit = async () => {
    if (!selectedDesign || !selectedMaterial || quantity <= 0) {
      alert('Please fill all required fields');
      return;
    }

    if (hasInsufficientStock) {
      alert('Cannot create order: Insufficient material stock');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/production-orders/create-with-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId: selectedDesign.id,
          materialId: selectedMaterial.id,
          quantity,
          customerRef,
        }),
      });

      if (response.ok) {
        alert('Production order created successfully!');
        // Reset form
        setSelectedDesign(null);
        setSelectedMaterial(null);
        setQuantity(0);
        setCustomerRef("");
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to create production order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl bg-[#161719] border border-[#2a2d32] rounded-2xl p-8">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="text-[#4caf7d]" /> New Production Order
        </h2>
        <p className="text-sm text-[#7a8090]">Initialize a job and reserve raw material for the workshop.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#7a8090] uppercase">Select Product Design</label>
            <select
              onChange={(e) => setSelectedDesign(designs.find(d => d.id === e.target.value))}
              className="w-full bg-[#1e2023] border border-[#2c2d33] rounded-xl p-3 text-white outline-none focus:border-[#4caf7d]"
            >
              <option value="">-- Choose Blueprint --</option>
              {designs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#7a8090] uppercase">Order Quantity (Units)</label>
              <input
                type="number"
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-[#1e2023] border border-[#2c2d33] rounded-xl p-3 text-white outline-none focus:border-[#4caf7d]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#7a8090] uppercase">Customer Reference</label>
              <input
                placeholder="e.g. PO-882"
                value={customerRef}
                onChange={(e) => setCustomerRef(e.target.value)}
                className="w-full bg-[#1e2023] border border-[#2c2d33] rounded-xl p-3 text-white outline-none focus:border-[#4caf7d]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#7a8090] uppercase">Assign Raw Material Stock</label>
            <select
              value={selectedMaterial?.id || ""}
              onChange={(e) => setSelectedMaterial(materials.find(m => m.id === e.target.value) || null)}
              className={`w-full bg-[#1e2023] border rounded-xl p-3 text-white outline-none focus:border-[#4caf7d] ${
                selectedMaterial && hasInsufficientStock ? 'border-red-500/50' : 'border-[#2c2d33]'
              }`}
            >
              <option value="">-- Select Rod from Warehouse --</option>
              {materials.map(m => {
                const materialRequiredKg = requiredKg;
                const materialHasInsufficient = materialRequiredKg > 0 && materialRequiredKg > m.availableKg;
                return (
                  <option
                    key={m.id}
                    value={m.id}
                    className={materialHasInsufficient ? 'text-red-400' : ''}
                  >
                    {m.materialName} ({m.diameter}) - {m.availableKg}kg available
                    {materialRequiredKg > 0 && materialHasInsufficient && " ⚠️ INSUFFICIENT"}
                  </option>
                );
              })}
            </select>
            {selectedMaterial && hasInsufficientStock && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                This material doesn&apos;t have enough stock for this order
              </p>
            )}
          </div>
        </div>

        {/* Right: Summary & Validation */}
        <div className="bg-[#0f1113] rounded-2xl p-6 border border-[#2a2d32] flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#7a8090] uppercase tracking-widest">Order Summary</h3>

            <div className="flex justify-between items-end">
              <span className="text-sm text-[#7a8090]">Estimated Mass</span>
              <span className="text-xl font-mono font-bold text-white">{requiredKg.toFixed(2)} kg</span>
            </div>

            {selectedMaterial && requiredKg > 0 && (
              <div className="flex justify-between items-end">
                <span className="text-sm text-[#7a8090]">Remaining Stock</span>
                <span className={`text-lg font-mono font-bold ${hasInsufficientStock ? 'text-red-400' : 'text-emerald-400'}`}>
                  {remainingKg} kg
                </span>
              </div>
            )}

            {stockValidationError && (
              <div className="flex items-start gap-2 text-[11px] text-red-400 bg-red-900/20 p-2 rounded-lg border border-red-500/30">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>{stockValidationError}</p>
              </div>
            )}

            <div className="pt-4 border-t border-[#2a2d32]">
              <div className="flex items-start gap-2 text-[11px] text-[#7a8090]">
                <AlertCircle size={14} className="text-[#f0c040] shrink-0" />
                <p>Reserving this material will remove it from the &quot;Available&quot; pool in the warehouse.</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || hasInsufficientStock}
            className="w-full mt-6 bg-[#4caf7d] hover:bg-[#439a6e] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#4caf7d]/10"
          >
            <PlayCircle size={20} /> {isSubmitting ? 'CREATING...' : hasInsufficientStock ? 'INSUFFICIENT STOCK' : 'RELEASE TO PRODUCTION'}
          </button>
        </div>
      </div>
    </div>
  );
}