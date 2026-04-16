import { Weight, Hash, Factory, PlusCircle, Truck } from "lucide-react";
import { addRawMaterial } from "@/app/actions/inventory";

export function RawMaterialIntake() {
  return (
    <div className="max-w-2xl bg-[#161719] border border-[#2a2d32] rounded-2xl p-8">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Weight className="text-[#4a9eff]" /> Raw Material Receipt
        </h2>
        <p className="text-sm text-[#7a8090]">Log incoming rod stock into the central warehouse.</p>
      </div>

      <form action={addRawMaterial} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Material Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#7a8090] uppercase">Material Specification</label>
            <div className="relative">
              <Factory className="absolute left-3 top-3 text-[#353a40]" size={18} />
              <input
                name="materialName"
                placeholder="e.g. Mild Steel S235"
                className="w-full bg-[#1e2023] border border-[#2c2d33] rounded-xl p-3 pl-10 text-white focus:border-[#4a9eff] outline-none"
              />
            </div>
          </div>

          {/* Diameter/Size */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#7a8090] uppercase">Size/Diameter</label>
            <div className="relative">
              <Hash className="absolute left-3 top-3 text-[#353a40]" size={18} />
              <input
                name="diameter"
                placeholder="e.g. M12 / 12mm"
                className="w-full bg-[#1e2023] border border-[#2c2d33] rounded-xl p-3 pl-10 text-white focus:border-[#4a9eff] outline-none"
              />
            </div>
          </div>

          {/* Supplier */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#7a8090] uppercase">Supplier</label>
            <div className="relative">
              <Truck className="absolute left-3 top-3 text-[#353a40]" size={18} />
              <input
                name="supplier"
                placeholder="e.g. SteelCorp Ltd"
                className="w-full bg-[#1e2023] border border-[#2c2d33] rounded-xl p-3 pl-10 text-white focus:border-[#4a9eff] outline-none"
              />
            </div>
          </div>

          {/* Weight In */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#4a9eff] uppercase">Total Weight Received (Kg)</label>
            <input
              name="kg"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full bg-[#1e2023] border border-[#4a9eff]/30 rounded-xl p-4 text-2xl font-mono text-white focus:border-[#4a9eff] outline-none"
            />
          </div>
        </div>

        <button className="w-full bg-[#4a9eff] hover:bg-[#3b8ae6] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all">
          <PlusCircle size={20} /> ADD TO WAREHOUSE STOCK
        </button>
      </form>
    </div>
  );
}