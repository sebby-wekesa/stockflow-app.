export const dynamic = 'force-dynamic';

import { getMonthlyYieldReport } from "@/app/actions/reports";
import { YieldReportView } from "@/components/admin/YieldReportView";

export default async function AdminReportsPage() {
  const reportData = await getMonthlyYieldReport();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="section-header">
        <div>
          <h1 className="section-title">Monthly Yield Report</h1>
          <p className="section-sub">Comprehensive performance analysis for the last 30 days</p>
        </div>
      </div>

      <YieldReportView data={reportData} />
    </div>
  );
}