"use client";

import { ShoppingCart, Search, Package, CheckCircle2, Tag } from "lucide-react";
import { useState } from "react";

export function SalesCatalogue({ products }: { products: any[] }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Search and Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Sales Catalogue</h2>
          <p className="text-sm text-[#7a8090]">Browse available finished goods and stock levels.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 text-[#353a40]" size={18} />
          <input 
            type="text"
            placeholder="Search products..."
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#161719] border border-[#2a2d32] rounded-xl p-2.5 pl-10 text-white focus:border-[#4a9eff] outline-none transition-all"
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-[#161719] border border-[#2a2d32] rounded-2xl overflow-hidden group hover:border-[#4a9eff]/30 transition-all">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-[#1e2023] rounded-lg text-[#4a9eff]">
                  <Package size={20} />
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${product.stock > 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {product.stock > 0 ? "In Stock" : "Out of Stock"}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-[#e8eaed] leading-tight">{product.name}</h3>
                <p className="text-xs text-[#7a8090] mt-1">{product.description}</p>
              </div>

              <div className="pt-4 border-t border-[#2a2d32] flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold text-[#7a8090] uppercase">Available</p>
                  <p className="text-xl font-mono font-bold text-white">
                    {product.stock.toLocaleString()} <span className="text-xs font-normal opacity-50">pcs</span>
                  </p>
                </div>
                <button className="p-3 bg-[#4a9eff] text-white rounded-xl hover:bg-[#3b8ae6] transition-colors shadow-lg shadow-[#4a9eff]/10">
                  <ShoppingCart size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}