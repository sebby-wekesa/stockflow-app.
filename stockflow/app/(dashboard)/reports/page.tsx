import { getMonthlyYieldReport } from "@/app/actions/reports";
import { YieldReportView } from "@/components/admin/YieldReportView";

export default async function ReportsPage() {
  const reportData = await getMonthlyYieldReport();

  return (
    <div className="p-8 bg-[#0f1113] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Monthly Yield Report</h1>
          <p className="text-[#7a8090]">Comprehensive performance analysis for the last 30 days</p>
        </div>

        <YieldReportView data={reportData} />
      </div>
    </div>
  );
}