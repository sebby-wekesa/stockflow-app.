import Link from 'next/link'
import { startOfDay, startOfWeek } from 'date-fns'
import { approveOrderAction } from '@/app/actions/dashboard'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'badge-muted',
  MEDIUM: 'badge-blue',
  HIGH: 'badge-amber',
  URGENT: 'badge-red',
}

export default async function ManagerDashboard() {
  const user = await requireActiveAuth()
  const db = getTenantPrisma(user.organizationId)
  const todayStart = startOfDay(new Date())
  const weekStart = startOfWeek(new Date())

  const [pendingApprovals, activeOrders, operators, todayLogs, weeklyLogs, completedToday] = await Promise.all([
    db.productionOrder.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        design: {
          select: {
            name: true,
            code: true,
            targetDimensions: true,
            _count: { select: { stages: true, billOfMaterials: true } },
          },
        },
      },
    }),
    db.productionOrder.findMany({
      where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] } },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      include: {
        design: { select: { name: true, _count: { select: { stages: true } } } },
        StageLog: { select: { id: true } },
      },
    }),
    db.user.findMany({
      where: { role: 'OPERATOR' },
      select: { department: true, departments: true },
    }),
    db.stageLog.findMany({
      where: { completedAt: { gte: todayStart } },
      select: { orderId: true, department: true, kgOut: true, kgScrap: true, operatorId: true },
    }),
    db.stageLog.findMany({
      where: { completedAt: { gte: weekStart } },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        department: true,
        stageName: true,
        kgIn: true,
        kgScrap: true,
        completedAt: true,
        ProductionOrder: { select: { id: true, orderNumber: true } },
      },
    }),
    db.productionOrder.count({ where: { status: 'COMPLETED', completedAt: { gte: todayStart } } }),
  ])

  const totalActiveKg = activeOrders.reduce((sum, order) => sum + Number(order.targetKg), 0)
  const weeklyScrap = weeklyLogs.reduce((sum, log) => sum + Number(log.kgScrap), 0)
  const scrapAlerts = weeklyLogs
    .filter((log) => Number(log.kgIn) > 0 && Number(log.kgScrap) / Number(log.kgIn) > 0.05)
    .slice(0, 6)

  const departmentNames = new Set<string>()
  activeOrders.forEach((order) => departmentNames.add(order.currentDept || 'Unassigned'))
  todayLogs.forEach((log) => departmentNames.add(log.department || 'Unassigned'))

  const departments = Array.from(departmentNames).map((department) => {
    const jobs = activeOrders.filter((order) => (order.currentDept || 'Unassigned') === department)
    const logs = todayLogs.filter((log) => (log.department || 'Unassigned') === department)
    const operatorIds = new Set(logs.map((log) => log.operatorId))
    const assignedOperators = operators.filter((operator) =>
      operator.department === department || operator.departments.includes(department)
    ).length
    const output = logs.reduce((sum, log) => sum + Number(log.kgOut), 0)
    const scrap = logs.reduce((sum, log) => sum + Number(log.kgScrap), 0)
    const processed = output + scrap

    return {
      department,
      jobs: jobs.length,
      targetKg: jobs.reduce((sum, order) => sum + Number(order.targetKg), 0),
      operators: Math.max(assignedOperators, operatorIds.size),
      output,
      yieldRate: processed > 0 ? (output / processed) * 100 : 0,
    }
  }).sort((a, b) => b.jobs - a.jobs)

  return (
    <div className="manager-page">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Production Manager Dashboard</div>
          <div className="section-sub">Live approvals, department workload, throughput, and scrap</div>
        </div>
        <div className="flex gap-2">
          <Link href="/approvals" className="btn btn-ghost">Review approvals</Link>
          <Link href="/production/new" className="btn btn-primary">+ Production order</Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-label">Active production</div>
          <div className="stat-value">{activeOrders.length.toLocaleString()}</div>
          <div className="stat-sub">{totalActiveKg.toLocaleString()} kg in process</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Pending approvals</div>
          <div className="stat-value">{pendingApprovals.length.toLocaleString()}</div>
          <div className="stat-sub">Orders waiting for release</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Completed today</div>
          <div className="stat-value">{completedToday.toLocaleString()}</div>
          <div className="stat-sub">{todayLogs.length.toLocaleString()} stages logged today</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Scrap this week</div>
          <div className="stat-value">{weeklyScrap.toFixed(1)}<span className="stat-suffix">kg</span></div>
          <div className="stat-sub">{scrapAlerts.length} logs above 5%</div>
        </div>
      </div>

      <div className="grid-2 manager-overview-grid">
        <div className="card">
          <div className="section-header mb-16">
            <div><div className="section-title">Department Workload</div><div className="section-sub">Active jobs and today&apos;s output</div></div>
            <Link href="/jobs?status=IN_PRODUCTION" className="btn btn-ghost btn-sm">View jobs →</Link>
          </div>
          <div className="manager-departments">
            {departments.map((department) => (
              <div key={department.department} className="manager-department-row">
                <div className="manager-department-copy">
                  <strong>{department.department}</strong>
                  <span>{department.operators} operators · {department.targetKg.toFixed(1)} kg queued</span>
                </div>
                <div className="manager-department-metrics">
                  <span><strong>{department.jobs}</strong> jobs</span>
                  <span><strong>{department.output.toFixed(1)}</strong> kg today</span>
                  <span className={department.yieldRate > 0 && department.yieldRate < 95 ? 'manager-warn' : ''}>
                    <strong>{department.yieldRate.toFixed(1)}%</strong> yield
                  </span>
                </div>
              </div>
            ))}
            {departments.length === 0 && <div className="manager-empty">No active department workload.</div>}
          </div>
        </div>

        <div className="card">
          <div className="section-header mb-16">
            <div><div className="section-title">Weekly Scrap Alerts</div><div className="section-sub">Stage logs above 5% scrap</div></div>
            <Link href="/reports" className="btn btn-ghost btn-sm">Production report →</Link>
          </div>
          <div className="manager-alerts">
            {scrapAlerts.map((log) => {
              const scrapRate = Number(log.kgIn) > 0 ? (Number(log.kgScrap) / Number(log.kgIn)) * 100 : 0
              return (
                <Link key={log.id} href={`/jobs/${log.ProductionOrder.id}`} className="manager-alert-row">
                  <div>
                    <span className="job-id">{log.ProductionOrder.orderNumber}</span>
                    <strong>{log.stageName}</strong>
                    <span>{log.department || 'Unassigned'} · {log.completedAt.toLocaleDateString()}</span>
                  </div>
                  <div className="manager-alert-value">{scrapRate.toFixed(1)}%</div>
                </Link>
              )
            })}
            {scrapAlerts.length === 0 && <div className="manager-empty">No weekly stage logs exceed 5% scrap.</div>}
          </div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div><div className="section-title">Pending Approvals</div><div className="section-sub">Review specifications and release orders to production</div></div>
          <span className="badge badge-amber">{pendingApprovals.length} pending</span>
        </div>
        <div className="manager-approval-grid">
          {pendingApprovals.slice(0, 6).map((order) => (
            <div key={order.id} className="manager-approval-card">
              <div className="approval-header">
                <div>
                  <span className="job-id">{order.orderNumber}</span>
                  <div className="manager-approval-title">{order.design?.name ?? order.productName ?? 'Direct order'}</div>
                  <div className="section-sub">
                    {order.design ? `${order.design.code} · ${order.design.targetDimensions || 'No dimensions recorded'}` : `${order.expectedPieces ?? order.quantity} expected pieces · direct order`}
                  </div>
                </div>
                <span className={`badge ${PRIORITY_BADGE[order.priority]}`}>{order.priority}</span>
              </div>
              <div className="manager-approval-metrics">
                <span><strong>{order.quantity.toLocaleString()}</strong> units</span>
                <span><strong>{Number(order.targetKg).toLocaleString()}</strong> kg</span>
                <span><strong>{order.design?._count.stages ?? 1}</strong> {order.design ? 'stages' : 'output step'}</span>
                <span><strong>{order.design?._count.billOfMaterials ?? 0}</strong> {order.design ? 'materials' : 'BOM items'}</span>
              </div>
              <div className="approval-actions">
                <form action={approveOrderAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <button className="btn btn-teal">Approve & release</button>
                </form>
                <Link href={`/jobs/${order.id}`} className="btn btn-ghost">View details</Link>
              </div>
            </div>
          ))}
          {pendingApprovals.length === 0 && <div className="manager-empty manager-full">No orders are waiting for approval.</div>}
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div><div className="section-title">Active Production Orders</div><div className="section-sub">Highest priority work currently moving through production</div></div>
          <Link href="/jobs" className="btn btn-ghost btn-sm">All production orders →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Design</th><th>Priority</th><th>Department</th><th>Target</th><th>Progress</th><th>Updated</th></tr></thead>
            <tbody>
              {activeOrders.slice(0, 10).map((order) => {
                const totalStages = order.design?._count.stages ?? 1
                const completedStages = order.StageLog.length
                const progress = order.design
                  ? totalStages > 0 ? Math.min(100, completedStages / totalStages * 100) : 0
                  : order.status === 'COMPLETED' ? 100 : 0
                return (
                  <tr key={order.id}>
                    <td><Link href={`/jobs/${order.id}`} className="sales-order-link">{order.orderNumber}</Link></td>
                    <td>{order.design?.name ?? order.productName ?? 'Direct order'}</td>
                    <td><span className={`badge ${PRIORITY_BADGE[order.priority]}`}>{order.priority}</span></td>
                    <td><span className="badge badge-muted">{order.currentDept || 'Unassigned'}</span></td>
                    <td><span className="job-kg">{Number(order.targetKg).toLocaleString()} kg</span></td>
                    <td><div className="manager-progress"><span style={{ width: `${progress}%` }} /></div><div className="section-sub">{completedStages}/{totalStages} stages</div></td>
                    <td className="section-sub">{order.updatedAt.toLocaleDateString()}</td>
                  </tr>
                )
              })}
              {activeOrders.length === 0 && <tr><td colSpan={7} className="sales-empty">No production orders are currently active.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
