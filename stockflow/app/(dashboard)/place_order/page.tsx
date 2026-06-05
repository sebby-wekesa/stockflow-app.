"use client";

import { Package } from "lucide-react";
import { ProductionOrderTabs } from "@/components/ProductionOrderTabs";

export default function PlaceOrderPage() {
  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Place Production Order</h1>
          <div className="section-sub">Create direct production orders or use a saved design template</div>
        </div>
        <div className="badge badge-amber">
          <Package size={14} /> New order
        </div>
      </div>

      <ProductionOrderTabs />
    </div>
  );
}
