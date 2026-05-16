import { getManagerData, approveOrder } from '@/app/actions/dashboard'

export default async function ManagerContent() {
  const { pendingApprovals, activeProduction, scrapAlerts, totalActiveOrders, totalTonnage, pendingCount } = await getManagerData()

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Production Manager Dashboard</div><div className="section-sub">Oversee production approvals and department queues</div></div>
      </div>

      {/* Overview Tiles */}
      <div className="stats-grid">
        <div className="stat-card teal">
          <div className="stat-label">Active production orders</div>
          <div className="stat-value">{totalActiveOrders}</div>
          <div className="stat-sub">Orders in production</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Total tonnage</div>
          <div className="stat-value">{totalTonnage.toFixed(0)}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
          <div className="stat-sub">In production</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Pending approvals</div>
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-sub">Awaiting review</div>
        </div>
      </div>

      {/* Approvals List */}
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Order approvals</div><div className="section-sub">Review specifications and release to production</div></div>
        {pendingApprovals.length > 0 ? (
          pendingApprovals.map((order: any) => (
            <div key={order.id} className="approval-card">
              <div className="approval-header">
                <div>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'11px',color:'var(--muted)'}}>{order.orderNumber}</span>
                  <div style={{fontFamily:'var(--font-head)',fontSize:'16px',fontWeight:'700',margin:'4px 0'}}>{order.design.name}</div>
                  <div style={{fontSize:'12px',color:'var(--muted)'}}>{order.quantity} units · {order.targetKg.toFixed(0)} kg</div>
                </div>
                <span className="badge badge-amber">Pending approval</span>
              </div>
              <div className="grid-2" style={{gap:'10px',marginBottom:'2px'}}>
                <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>QUANTITY</div><div style={{fontWeight:'600',marginTop:'3px'}}>{order.quantity} units</div></div>
                <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>KG RESERVED</div><div style={{fontFamily:'var(--font-mono)',marginTop:'3px',color:'var(--accent)'}}>{order.targetKg.toFixed(0)} kg</div></div>
                <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>MATERIAL</div><div style={{fontSize:'12px',marginTop:'3px'}}>Steel rod {order.materialDiameter}mm</div></div>
                <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>SPECIFICATIONS</div><div style={{fontSize:'12px',marginTop:'3px'}}>{order.design.code} · {order.targetDims}</div></div>
              </div>
              <div className="approval-actions">
                <form action={approveOrder.bind(null, order.id)}>
                  <button className="btn btn-teal">Approve & release</button>
                </form>
                <button className="btn btn-ghost">Edit specs</button>
                <button className="btn btn-red btn-sm" style={{marginLeft:'auto'}}>Reject</button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px', color: 'var(--muted)', textAlign: 'center' }}>
            No pending approvals.
          </div>
        )}
      </div>

      {/* Department Queues */}
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Department queues</div><div className="section-sub">Current workload distribution</div></div>
        {activeProduction.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Department</th><th>Active jobs</th><th>Kg in process</th><th>Operators</th></tr></thead>
              <tbody>
                {activeProduction.map((dept: any) => (
                  <tr key={dept.currentDept}>
                    <td>{dept.currentDept || 'Unassigned'}</td>
                    <td>{dept._count._all}</td>
                    <td><span className="job-kg">{dept._sum.targetKg?.toFixed(0) || 0} kg</span></td>
                    <td>{dept.operatorCount || 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '20px', color: 'var(--muted)', textAlign: 'center' }}>
            No active production orders.
          </div>
        )}
      </div>
    </div>
  )
}