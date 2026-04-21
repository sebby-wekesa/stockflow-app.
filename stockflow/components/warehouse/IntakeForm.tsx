// components/warehouse/IntakeForm.tsx
"use client";

import { useState } from "react";
import { receiveRawMaterial } from "@/lib/actions/inventory";

export default function IntakeForm({ materials, suppliers }: { materials: any[], suppliers: any[] }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    
    const res = await receiveRawMaterial({
      rawMaterialId: formData.get("materialId") as string,
      supplierId: formData.get("supplierId") as string,
      quantity: parseFloat(formData.get("quantity") as string),
    });

    setLoading(false);
    setStatus(res.success ? "Stock updated successfully!" : "Error updating stock.");
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 p-6 bg-white border rounded-lg shadow-sm">
      <h2 className="text-xl font-bold">Log Incoming Material</h2>
      
      <div>
        <label className="block text-sm font-medium">Raw Material / Rod Type</label>
        <select name="materialId" className="w-full border p-2 rounded mt-1" required>
          {materials.map(m => (
            <option key={m.id} value={m.id}>{m.materialName} ({m.diameter})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Supplier</label>
        <select name="supplierId" className="w-full border p-2 rounded mt-1" required>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Weight Received (Kg)</label>
        <input name="quantity" type="number" step="0.01" className="w-full border p-2 rounded mt-1" placeholder="0.00" required />
      </div>

      <button disabled={loading} type="submit" className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700">
        {loading ? "Updating..." : "Receive Into Stock"}
      </button>

      {status && <p className="text-center text-sm font-medium mt-2">{status}</p>}
    </form>
  );
}