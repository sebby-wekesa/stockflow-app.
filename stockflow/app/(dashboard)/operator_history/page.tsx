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

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Operator History</div>
          <div className="section-sub">Recent stage logs from production</div>
        </div>
      </div>

      <div className="card">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No completed work logged yet.</div>
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
                    <td className="font-mono text-sm">{log.ProductionOrder.orderNumber}</td>
                    <td>{log.ProductionOrder.design.name}</td>
                    <td>{log.stageName}</td>
                    <td>{log.department}</td>
                    <td className="font-mono text-sm">{Number(log.kgOut).toFixed(2)} kg</td>
                    <td className="font-mono text-sm">{Number(log.kgScrap).toFixed(2)} kg</td>
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
