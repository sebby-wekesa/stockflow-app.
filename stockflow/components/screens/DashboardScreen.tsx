export function DashboardScreen() {
  return (
    <>
      <div className="section-header mb-16">
        <div><div className="section-title">Overview</div><div className="section-sub">Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div></div>
        <button className="btn btn-primary" onClick={() => alert('New production order modal would open')}>+ New production order</button>
      </div>
      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-label">Raw material stock</div>
          <div className="stat-value">—<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
          <div className="stat-sub">Loading...</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Active production orders</div>
          <div className="stat-value">—</div>
          <div className="stat-sub">Loading...</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Finished goods ready</div>
          <div className="stat-value">—<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
          <div className="stat-sub">Loading...</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Scrap this week</div>
          <div className="stat-value">—<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
          <div className="stat-sub">Loading...</div>
        </div>
      </div>
      <div className="grid-2 mb-16">
        <div className="card">
          <div className="section-header mb-16"><div className="section-title">Recent production orders</div><button className="btn btn-ghost btn-sm">View all</button></div>
          <div style={{padding: '20px', textAlign: 'center', color: 'var(--muted)'}}>
            No recent orders to display
          </div>
        </div>
        <div className="card">
          <div className="section-header mb-16"><div className="section-title">Scrap by department</div><div style={{fontSize:'11px',color:'var(--muted)'}}>This week</div></div>
          <div style={{padding: '20px', textAlign: 'center', color: 'var(--muted)'}}>
            No scrap data available
          </div>
        </div>
      </div>
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Department throughput — today</div></div>
        <div style={{padding: '20px', textAlign: 'center', color: 'var(--muted)'}}>
          No department data available
        </div>
      </div>
    </>
  );
}