export function RawMaterialsScreen() {
  return (
    <>
      <div className="section-header mb-16">
        <div><div className="section-title">Raw materials</div><div className="section-sub">Current stock levels in kg</div></div>
        <button className="btn btn-primary" onClick={() => alert('Receive stock modal would open')}>+ Receive stock</button>
      </div>
      <div style={{padding: '40px', textAlign: 'center', color: 'var(--muted)'}}>
        No materials to display
      </div>
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Receipt history</div></div>
        <div style={{padding: '20px', textAlign: 'center', color: 'var(--muted)'}}>
          No receipt history available
        </div>
      </div>
    </>
  );
}