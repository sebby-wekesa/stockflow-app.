import Link from 'next/link'
import { RANGE_LABELS, type DateRangeKey } from '@/lib/reports'

export const dynamic = 'force-dynamic'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const currentRange = (params.range as DateRangeKey) || '30d'

  const reportLinks = [
    {
      title: 'Sales Report',
      description: 'Revenue, branch breakdown, top products & customers',
      href: `/api/reports/sales?range=${currentRange}`,
      icon: '📊',
      disabled: false,
    },
    {
      title: 'Stock Report',
      description: 'Current inventory levels across all branches',
      href: `/api/reports/stock?range=${currentRange}`,
      icon: '📦',
      disabled: false,
    },
    {
      title: 'Production Report',
      description: 'Output, scrap rate per stage and yield analysis',
      href: `/api/reports/production?range=${currentRange}`,
      icon: '⚙️',
      disabled: false,
    },
  ]

  return (
    <div>
      <div className="section-header mb-16">
        <div className="section-title">Reports</div>
        <div className="section-sub">Export data for analysis and reporting</div>
      </div>

      {/* Date Range Selector */}
      <div className="card mb-16">
        <div className="section-header mb-6">
          <div className="section-title">Report Period</div>
          <div className="section-sub">Select the time range for your reports</div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.entries(RANGE_LABELS) as [DateRangeKey, string][]).map(([key, label]) => (
            <Link
              key={key}
              href={`/reports?range=${key}`}
              className={`btn ${
                currentRange === key
                  ? 'btn-primary'
                  : 'btn-secondary'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="text-muted text-sm">
          Current period: <span className="text-primary font-medium">{RANGE_LABELS[currentRange]}</span>
        </div>
      </div>

      {/* Report Cards */}
      <div className="section-header mb-8">
        <div className="section-title">Available Reports</div>
        <div className="section-sub">Click any report to download as CSV</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportLinks.map((report) => (
          <div key={report.title} className="card group hover:border-accent transition-colors">
            <div className="p-6">
              <div className="text-3xl mb-4">{report.icon}</div>
              <h3 className="section-title mb-3">{report.title}</h3>
              <p className="text-muted text-sm mb-6 leading-relaxed">{report.description}</p>
              <a
                href={report.href}
                className="btn btn-primary w-full group-hover:bg-accent-orange transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download CSV
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="card bg-accent-amber/5 border-accent-amber/20">
        <div className="p-6">
          <h4 className="section-title mb-3 flex items-center gap-2">
            <span className="text-xl">💡</span>
            <span>Pro Tip</span>
          </h4>
          <p className="text-muted text-sm leading-relaxed">
            CSV files open directly in Excel, Google Sheets, or any spreadsheet application.
            Use the date range selector above to customize the reporting period for all reports.
          </p>
        </div>
      </div>
    </div>
  )
}