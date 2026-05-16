"use client";

import { FileText, Download, TrendingUp, Trash2, BarChart3 } from "lucide-react";
import { useState } from "react";


interface DepartmentBreakdown {
  department: string;
  totalIn: number;
  totalOut: number;
  totalScrap: number;
  yieldEfficiency: number;
  stageCount: number;
}

interface YieldReportData {
  totalIn: number;
  totalOut: number;
  totalScrap: number;
  yieldEfficiency: string;
  deptBreakdown: DepartmentBreakdown[];
}

export function YieldReportView({ data }: { data: YieldReportData }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);

      const endDate = new Date();
      const response = await fetch(`/api/reports/export-csv?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`);
      if (!response.ok) {
        throw new Error('Failed to download CSV');
      }
      const csv = await response.text();

      // Create and download the file
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yield-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const scrapPercentage = data.totalIn > 0 ? ((data.totalScrap / data.totalIn) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="text-[#4a9eff]" /> Factory Yield Report
        </h2>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 bg-[#1e2023] border border-[#2a2d32] text-white px-4 py-2 rounded-xl hover:bg-[#2a2d32] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Global Efficiency Score */}
        <div className="bg-[#161719] border border-[#2a2d32] p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10 text-[#4a9eff]">
             <TrendingUp size={100} />
          </div>
          <p className="text-[10px] font-bold text-[#7a8090] uppercase tracking-widest">Yield Efficiency</p>
          <p className="text-4xl font-mono font-bold text-white mt-2">{data.yieldEfficiency}%</p>
          <div className="mt-4 flex items-center gap-1 text-xs text-emerald-500">
             <span>+2.4% from last month</span>
          </div>
        </div>

        {/* Total Material Loss */}
        <div className="bg-[#161719] border border-[#2a2d32] p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10 text-red-400">
             <Trash2 size={100} />
          </div>
          <p className="text-[10px] font-bold text-[#7a8090] uppercase tracking-widest">Total Scrap (Waste)</p>
          <p className="text-4xl font-mono font-bold text-red-400 mt-2">{data.totalScrap.toFixed(1)} <span className="text-lg">kg</span></p>
          <div className="mt-4 flex items-center gap-2">
             <div className="h-1.5 w-full bg-[#1e2023] rounded-full overflow-hidden">
                <div className="h-full bg-red-400" style={{ width: `${scrapPercentage}%` }}></div>
             </div>
             <span className="text-xs text-[#7a8090]">{scrapPercentage}%</span>
          </div>
        </div>

        {/* Production Volume */}
        <div className="bg-[#161719] border border-[#2a2d32] p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10 text-[#4a9eff]">
             <BarChart3 size={100} />
          </div>
          <p className="text-[10px] font-bold text-[#7a8090] uppercase tracking-widest">Total Throughput</p>
          <p className="text-4xl font-mono font-bold text-[#4a9eff] mt-2">{data.totalOut.toFixed(1)} <span className="text-lg">kg</span></p>
          <p className="text-xs text-[#7a8090] mt-4">Finished goods produced</p>
        </div>
      </div>

      {/* Department Breakdown */}
      {data.deptBreakdown.length > 0 && (
        <div className="bg-[#161719] border border-[#2a2d32] rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="text-[#4a9eff]" />
            Department Performance
          </h3>
          <div className="space-y-4">
            {data.deptBreakdown.map((dept) => (
              <div key={dept.department} className="flex items-center justify-between p-4 bg-[#0f1113] rounded-xl">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-white">{dept.department}</span>
                    <span className="text-sm font-mono text-[#4a9eff]">{dept.yieldEfficiency.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#7a8090]">
                    <span>{dept.stageCount} stages</span>
                    <span>{dept.totalScrap.toFixed(1)}kg scrap</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}