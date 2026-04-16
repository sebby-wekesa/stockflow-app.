"use client";

import { motion } from "framer-motion";
import { Factory, ArrowRight, LayoutGrid, Timer } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEPARTMENTS = ["Cutting", "Forging", "Threading", "Quality Control", "Packaging"];

interface WIPOrder {
  currentDept: string;
  targetKg: number;
}

interface WIPStatusProps {
  orders: WIPOrder[];
}

export default function WIPStatus({ orders }: WIPStatusProps) {
  return (
    <div className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
      
      {/* Background radial highlight */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-bold text-[#e8eaed] flex items-center gap-2">
            <Factory size={20} className="text-[#4a9eff]" />
            Live Factory Floor Status
          </h3>
          <p className="text-sm text-[#7a8090]">WIP inventory across all production departments</p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end">
             <span className="text-[10px] font-bold text-[#7a8090] uppercase tracking-tighter">Total Load</span>
             <span className="text-sm font-mono font-bold text-[#4a9eff]">
               {orders.reduce((sum, o) => sum + o.targetKg, 0).toLocaleString()} kg
             </span>
           </div>
        </div>
      </div>

      <div className="flex justify-between items-start gap-4 overflow-x-auto pb-4 custom-scrollbar">
        {DEPARTMENTS.map((dept, index) => {
          const deptOrders = (orders || []).filter(o => o.currentDept === dept);
          const totalKg = deptOrders.reduce((sum, o) => sum + o.targetKg, 0);
          const hasOrders = deptOrders.length > 0;

          return (
            <motion.div 
              key={dept} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center min-w-[160px] flex-1"
            >
              <div 
                className={cn(
                  "w-full p-5 rounded-2xl border transition-all duration-500 relative group",
                  hasOrders 
                    ? "bg-[#1e2023] border-[#4a9eff]/30 shadow-[0_0_20px_rgba(74,158,255,0.05)]" 
                    : "bg-[#161719]/50 border-[#2a2d32] opacity-60"
                )}
              >
                {/* Active Indicator */}
                {hasOrders && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                )}

                <div className="flex flex-col items-center text-center">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest mb-4",
                    hasOrders ? "text-[#4a9eff]" : "text-[#7a8090]"
                  )}>
                    {dept}
                  </span>
                  
                  <div className="mb-2">
                    <span className={cn(
                      "text-3xl font-mono font-bold transition-colors",
                      hasOrders ? "text-[#e8eaed]" : "text-[#353a40]"
                    )}>
                      {deptOrders.length}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-black/20 rounded-full border border-white/5">
                    <Timer size={10} className={hasOrders ? "text-blue-400" : "text-[#353a40]"} />
                    <span className={cn(
                      "text-[10px] font-mono",
                      hasOrders ? "text-[#7a8090]" : "text-[#353a40]"
                    )}>
                      {totalKg.toLocaleString()} kg
                    </span>
                  </div>
                </div>

                {/* Hover Effect Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
              </div>

              {index < DEPARTMENTS.length - 1 && (
                <div className="mt-6 hidden md:block opacity-20">
                  <ArrowRight size={18} className="text-[#7a8090]" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
