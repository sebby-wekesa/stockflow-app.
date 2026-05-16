"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { getBranches } from "@/app/actions/users";

export default function BranchSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [branches, setBranches] = useState<any[]>([]);
  const currentBranchId = searchParams.get("branchId") || "";

  useEffect(() => {
    getBranches().then(setBranches);
  }, []);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const branchId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (branchId) {
      params.set("branchId", branchId);
    } else {
      params.delete("branchId");
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-3 bg-[#161719] border border-[#2a2d32] px-4 py-2 rounded-xl focus-within:border-blue-500 transition-all">
      <MapPin size={18} className="text-[#7a8090]" />
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-[#7a8090] uppercase tracking-widest leading-none mb-1">
          Branch Location
        </span>
        <div className="relative flex items-center">
          <select
            value={currentBranchId}
            onChange={handleBranchChange}
            className="appearance-none bg-transparent text-sm font-semibold text-[#e8eaed] outline-none pr-6 cursor-pointer"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-0 text-[#7a8090] pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
