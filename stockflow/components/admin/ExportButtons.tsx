"use client";

import { FileSpreadsheet, FileType } from "lucide-react";
import { exportYieldToCSV } from "@/app/actions/export";

export function ExportButtons() {
  const handleCSVDownload = async () => {
    const csvData = await exportYieldToCSV();
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StockFlow_Yield_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={handleCSVDownload}
        className="flex items-center gap-2 bg-[#1e2023] border border-[#2a2d32] text-[#4caf7d] px-4 py-2.5 rounded-xl hover:bg-[#4caf7d]/10 transition-all text-sm font-medium"
      >
        <FileSpreadsheet size={18} />
        Export CSV (Excel)
      </button>

      <button
        className="flex items-center gap-2 bg-[#1e2023] border border-[#2a2d32] text-[#ff4a4a] px-4 py-2.5 rounded-xl hover:bg-[#ff4a4a]/10 transition-all text-sm font-medium"
        onClick={() => alert("PDF Generation requires 'jspdf' library installation.")}
      >
        <FileType size={18} />
        Export PDF
      </button>
    </div>
  );
}