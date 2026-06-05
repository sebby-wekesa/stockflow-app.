import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OperatorHistoryPage() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)

  if (user.role !== 'OPERATOR' && user.role !== 'ADMIN') {
    redirect('/unauthorized')
  }

  const logs = await db.stageLog.findMany({
    where: user.role === 'OPERATOR' ? { operatorId: user.id } : {},
    include: {
      ProductionOrder: {
        include: {
          design: true,
        },
      },
    },
    orderBy: { completedAt: 'desc' },
    take: 50,
  })
  const totalKgOut = logs.reduce((sum, log) => sum + Number(log.kgOut), 0)
  const totalScrap = logs.reduce((sum, log) => sum + Number(log.kgScrap), 0)
  const totalKgIn = logs.reduce((sum, log) => sum + Number(log.kgIn), 0)
  const yieldRate = totalKgIn > 0 ? (totalKgOut / totalKgIn) * 100 : 0

  return (
    <div className="operator-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">{user.role === 'OPERATOR' ? 'My Completed Work' : 'Operator History'}</div>
          <div className="section-sub">Live stage completion records from the production database</div>
        </div>
        <span className="badge badge-teal">{logs.length} recent logs</span>
      </div>

      <div className="stats-grid operator-stats">
        <div className="stat-card teal">
          <div className="stat-label">Stages completed</div>
          <div className="stat-value">{logs.length}</div>
          <div className="stat-sub">Most recent production logs</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Output recorded</div>
          <div className="stat-value">{totalKgOut.toFixed(1)}<span className="stat-suffix">kg</span></div>
          <div className="stat-sub">Across completed stages</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Recorded yield</div>
          <div className="stat-value">{yieldRate.toFixed(1)}<span className="stat-suffix">%</span></div>
          <div className="stat-sub">{totalScrap.toFixed(1)} kg scrap recorded</div>
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Completion Log</div>
            <div className="section-sub">Newest stage completions first</div>
          </div>
        </div>
        {logs.length === 0 ? (
          <div className="operator-empty">
            <div className="section-title">No completed work yet</div>
            <div className="section-sub">Completed stages will appear here after production is logged.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Design</th>
                  <th>Stage</th>
                  <th>Department</th>
                  <th>Kg Out</th>
                  <th>Scrap</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td><span className="job-id">{log.ProductionOrder.orderNumber}</span></td>
                    <td>{log.ProductionOrder.design?.name ?? log.ProductionOrder.productName ?? 'Direct order'}</td>
                    <td>{log.stageName}</td>
                    <td><span className="badge badge-muted">{log.department || 'Unassigned'}</span></td>
                    <td><span className="job-kg">{Number(log.kgOut).toFixed(2)} kg</span></td>
                    <td style={{ color: Number(log.kgScrap) > 0 ? 'var(--red)' : 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{Number(log.kgScrap).toFixed(2)} kg</td>
                    <td className="text-muted text-sm">
                      {new Date(log.completedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
